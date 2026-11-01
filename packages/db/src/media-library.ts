import { randomUUID, createHash } from "node:crypto";
import { getSqlClient } from "./index.ts";
import { inspectMediaUpload, mediaUploadLimit, type MediaUpload } from "./media-policy.ts";
import type { MediaKind } from "./media-validation.ts";

export async function storeMediaUpload(input: MediaUpload): Promise<{ id: string; revision: number }> {
  const asset = inspectMediaUpload(input);
  input = { ...input, content: asset.content };
  const sql = getSqlClient();
  return sql.begin(async tx => {
    // Serialize tenant quota checks with worker completions. No external storage
    // purchases or unbounded upload accumulation are implicit in this adapter.
    const tenant = await tx`SELECT id FROM organizations WHERE id=${input.organizationId} FOR UPDATE`;
    if (tenant.length !== 1) throw new Error("MEDIA_SCOPE_DENIED");
    const members = await tx`SELECT 1 FROM organization_memberships
      WHERE organization_id = ${input.organizationId} AND account_id = ${input.ownerId}
      AND status = 'active' AND suspended_at IS NULL FOR SHARE`;
    if (members.length !== 1) throw new Error("MEDIA_SCOPE_DENIED");
    const usage = await tx<{ bytes: number; versions: number }[]>`SELECT
      COALESCE(sum(COALESCE(octet_length(source_content),0)+COALESCE(octet_length(output_content),0)),0)::double precision AS bytes,
      count(*) FILTER (WHERE source_content IS NOT NULL OR output_content IS NOT NULL)::integer AS versions
      FROM media_versions WHERE organization_id=${input.organizationId}`;
    if (usage[0]!.bytes + asset.content.byteLength > 128 * 1024 * 1024 || usage[0]!.versions >= 256) {
      throw new Error("MEDIA_QUOTA_EXCEEDED");
    }
    const id = input.mediaId ?? randomUUID();
    const revision = input.expectedRevision + 1;
    if (input.mediaId) {
      const rows = await tx`UPDATE media_library SET current_revision = ${revision}
        WHERE id = ${id} AND organization_id = ${input.organizationId}
        AND owner_account_id = ${input.ownerId} AND current_revision = ${input.expectedRevision}
        AND revoked_at IS NULL RETURNING id`;
      if (rows.length !== 1) throw new Error("MEDIA_REVISION_CONFLICT");
    } else {
      await tx`INSERT INTO media_library(id, organization_id, owner_account_id)
        VALUES(${id}, ${input.organizationId}, ${input.ownerId})`;
    }
    await tx`INSERT INTO media_versions(media_id, organization_id, revision, kind, filename,
      source_mime, source_sha256, source_content, rights_version)
      VALUES(${id}, ${input.organizationId}, ${revision}, ${asset.kind}, ${asset.filename},
        ${asset.mime}, ${asset.sha256}, ${asset.content}, ${asset.rightsVersion})`;
    await tx`INSERT INTO media_library_audit(organization_id,media_id,revision,actor_account_id,action)
      VALUES(${input.organizationId},${id},${revision},${input.ownerId},'upload')`;
    return { id, revision };
  });
}

/** Owner-only private playback. Original uploads are never returned. */
export async function readMediaPlayback(organizationId: string, ownerId: string, id: string) {
  return getSqlClient().begin(async tx => {
    const rows = await tx<{ revision: number; mime: string; content: Uint8Array; sha256: string }[]>`
      SELECT v.revision, v.output_mime AS mime, v.output_content AS content, v.output_sha256 AS sha256
      FROM media_library m JOIN media_versions v ON v.media_id=m.id AND v.revision=m.current_revision
      JOIN organization_memberships a ON a.organization_id=m.organization_id AND a.account_id=m.owner_account_id
      WHERE m.id=${id} AND m.organization_id=${organizationId} AND m.owner_account_id=${ownerId}
      AND m.revoked_at IS NULL AND a.status='active' AND a.suspended_at IS NULL AND v.status='ready'
      FOR SHARE OF m, v, a`;
    const row = rows[0];
    if (!row) return null;
    await tx`INSERT INTO media_library_audit(organization_id,media_id,revision,actor_account_id,action)
      VALUES(${organizationId},${id},${row.revision},${ownerId},'playback')`;
    return { ...row, content: new Uint8Array(row.content) };
  });
}

export async function revokeMedia(organizationId: string, ownerId: string, id: string): Promise<boolean> {
  return getSqlClient().begin(async tx => {
    const rows = await tx<{ current_revision: number }[]>`UPDATE media_library SET revoked_at=now()
      WHERE id=${id} AND organization_id=${organizationId} AND owner_account_id=${ownerId}
      AND EXISTS(SELECT 1 FROM organization_memberships WHERE organization_id=${organizationId}
        AND account_id=${ownerId} AND status='active' AND suspended_at IS NULL)
      RETURNING current_revision`;
    if (!rows[0]) return false;
    await tx`UPDATE media_versions SET status='revoked', source_content=NULL, output_content=NULL,
      worker_token=NULL, worker_expires_at=NULL WHERE media_id=${id}`;
    await tx`INSERT INTO media_library_audit(organization_id,media_id,revision,actor_account_id,action)
      VALUES(${organizationId},${id},${rows[0].current_revision},${ownerId},'revoke')`;
    return true;
  });
}

export interface MediaWork {
  id: string; organizationId: string; revision: number; token: string; kind: MediaKind; content: Uint8Array;
}
/** Trusted worker only, never exposed as an HTTP mutation. Expired work is reclaimable. */
export async function claimMediaWork(): Promise<MediaWork | null> {
  return getSqlClient().begin(async tx => {
    const rows = await tx<{ media_id: string; organization_id: string; revision: number; kind: MediaKind; source_content: Uint8Array }[]>`
      SELECT v.media_id,v.organization_id,v.revision,v.kind,v.source_content FROM media_versions v
      JOIN media_library m ON m.id=v.media_id AND m.current_revision=v.revision
      WHERE m.revoked_at IS NULL AND (v.status='quarantined' OR (v.status='processing' AND v.worker_expires_at < now()))
      ORDER BY v.created_at LIMIT 1 FOR UPDATE OF v SKIP LOCKED`;
    const row = rows[0]; if (!row) return null;
    const token = randomUUID();
    await tx`UPDATE media_versions SET status='processing',worker_token=${token},worker_expires_at=now()+interval '5 minutes'
      WHERE media_id=${row.media_id} AND revision=${row.revision}`;
    return { id: row.media_id, organizationId: row.organization_id, revision: row.revision,
      token, kind: row.kind, content: new Uint8Array(row.source_content) };
  });
}

export interface MediaProcessed { mime: "image/jpeg" | "video/mp4" | "audio/ogg"; content: Uint8Array; safetyEvidence: string; }
/** A stale worker or revocation can never publish a result. */
export async function completeMediaWork(work: MediaWork, output: MediaProcessed | null): Promise<boolean> {
  if (output && (!(output.content instanceof Uint8Array) || output.content.byteLength < 1 ||
      output.content.byteLength > mediaUploadLimit || !output.safetyEvidence.trim() ||
      output.safetyEvidence.length > 2048 || output.mime !== ({ image: "image/jpeg",video:"video/mp4",audio:"audio/ogg" } as const)[work.kind])) {
    throw new Error("MEDIA_PROCESSING_INVALID");
  }
  return getSqlClient().begin(async tx => {
    // Lock aggregate first, like upload/revoke, so publication and revocation serialize.
    await tx`SELECT id FROM organizations WHERE id=${work.organizationId} FOR UPDATE`;
    const media = await tx`SELECT id FROM media_library WHERE id=${work.id} AND organization_id=${work.organizationId}
      AND current_revision=${work.revision} AND revoked_at IS NULL FOR UPDATE`;
    if (media.length !== 1) return false;
    const version = await tx<{ bytes: number }[]>`SELECT COALESCE(octet_length(source_content),0) AS bytes
      FROM media_versions WHERE media_id=${work.id} AND revision=${work.revision}
      AND status='processing' AND worker_token=${work.token} AND worker_expires_at > now() AND kind=${work.kind} FOR UPDATE`;
    if (!version[0]) return false;
    if (output) {
      const usage = await tx<{ bytes: number }[]>`SELECT
        COALESCE(sum(COALESCE(octet_length(source_content),0)+COALESCE(octet_length(output_content),0)),0)::double precision AS bytes
        FROM media_versions WHERE organization_id=${work.organizationId}`;
      if (usage[0]!.bytes - version[0].bytes + output.content.byteLength > 128 * 1024 * 1024) {
        throw new Error("MEDIA_QUOTA_EXCEEDED");
      }
    }
    const rows = await tx`UPDATE media_versions SET status=${output ? "ready" : "rejected"},
      source_content=NULL, output_mime=${output?.mime ?? null}, output_content=${output ? Buffer.from(output.content) : null},
      output_sha256=${output ? createHash("sha256").update(output.content).digest("hex") : null},
      safety_evidence=${output?.safetyEvidence ?? null},worker_token=NULL,worker_expires_at=NULL
      WHERE media_id=${work.id} AND revision=${work.revision} AND status='processing'
        AND worker_token=${work.token} AND worker_expires_at > now() RETURNING media_id`;
    if (rows.length !== 1) return false;
    await tx`INSERT INTO media_library_audit(organization_id,media_id,revision,action)
      VALUES(${work.organizationId},${work.id},${work.revision},${output ? "processed" : "reject"})`;
    return true;
  });
}

