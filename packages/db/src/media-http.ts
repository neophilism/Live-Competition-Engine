import { AuthenticationError, type AuthenticationService, type Principal } from "@live-competition-engine/auth";
import { mediaUploadLimit, mediaRightsVersion, type MediaUpload } from "./media-policy.ts";
import type { MediaKind } from "./media-validation.ts";

interface MediaStorage {
  list(organizationId:string,accountId:string):Promise<readonly {id:string;revision:number;filename:string;kind:MediaKind;status:string;createdAt:Date}[]>;
  upload(input: MediaUpload): Promise<{ id: string; revision: number }>;
  playback(organizationId: string, accountId: string, id: string): Promise<{ mime: string; content: Uint8Array; revision: number } | null>;
  revoke(organizationId: string, accountId: string, id: string): Promise<boolean>;
}
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const headers = { "cache-control": "private, no-store", vary: "Authorization", "x-content-type-options": "nosniff" };
const reply = (status: number, error: string) => Response.json({ error }, { status, headers });

export async function boundedMediaBody(request: Request, limit=mediaUploadLimit): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > limit)) {
    throw new Error("MEDIA_SIZE_FORBIDDEN");
  }
  if (!request.body) throw new Error("MEDIA_SIZE_FORBIDDEN");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error("MEDIA_SIZE_FORBIDDEN")),30_000);});
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(),deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("MEDIA_SIZE_FORBIDDEN");
      chunks.push(value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => {});
    throw cause;
  } finally { clearTimeout(timer!);reader.releaseLock(); }
  if (size === 0 || (declared !== null && Number(declared) !== size)) throw new Error("MEDIA_SIZE_FORBIDDEN");
  return new Uint8Array(Buffer.concat(chunks, size));
}

export function createMediaHandlers(authorizer: Pick<AuthenticationService, "authorize">, storage: MediaStorage) {
  async function authenticate(request: Request, organizationId: string, id?: string): Promise<Principal | Response> {
    if (!uuid(organizationId) || (id !== undefined && !uuid(id))) return reply(400, "invalid_media_scope");
    try {
      const principal = await authorizer.authorize(request.headers.get("authorization"), organizationId);
      return principal.organizationId === organizationId ? principal : reply(403, "forbidden");
    } catch (cause) {
      if (cause instanceof AuthenticationError) return reply(cause.code === "forbidden" ? 403 : 401, cause.code);
      return reply(503, "media_unavailable");
    }
  }
  return {
    async list(request:Request,organizationId:string):Promise<Response> {
      const actor=await authenticate(request,organizationId);if(actor instanceof Response)return actor;
      try{return Response.json({items:await storage.list(organizationId,actor.accountId)},{headers});}
      catch{return reply(503,"media_unavailable");}
    },
    async upload(request: Request, organizationId: string, mediaId?: string): Promise<Response> {
      const actor = await authenticate(request, organizationId, mediaId); if (actor instanceof Response) return actor;
      const rights = request.headers.get("x-media-rights-version");
      if (rights !== mediaRightsVersion) return reply(400, "media_rights_required");
      const revisionHeader = request.headers.get("if-match");
      const expectedRevision = mediaId && revisionHeader && /^[1-9][0-9]*$/.test(revisionHeader) ? Number(revisionHeader) : 0;
      if ((mediaId && !Number.isSafeInteger(expectedRevision)) || (mediaId && expectedRevision < 1) ||
          (!mediaId && revisionHeader !== null)) return reply(409, "media_revision_conflict");
      try {
        const result = await storage.upload({
          organizationId, ownerId: actor.accountId, mediaId, expectedRevision,
          kind: request.headers.get("x-media-kind") as MediaKind,
          mime: request.headers.get("content-type") ?? "",
          filename: request.headers.get("x-media-filename") ?? "",
          rightsVersion: rights, content: await boundedMediaBody(request)
        });
        return Response.json({ ...result, status: "quarantined" }, { status: 202, headers });
      } catch (cause) {
        const code = cause instanceof Error ? cause.message : "";
        if (code === "MEDIA_SIZE_FORBIDDEN") return reply(413, "media_size_forbidden");
        if (code === "MEDIA_QUOTA_EXCEEDED") return reply(409, "media_quota_exceeded");
        if (code === "MEDIA_SCOPE_DENIED") return reply(403, "forbidden");
        if (code === "MEDIA_REVISION_CONFLICT") return reply(409, "media_revision_conflict");
        if (/^MEDIA_(TYPE_FORBIDDEN|DIGEST_REQUIRED|FILENAME_INVALID|CONTENT_MISMATCH|ACTOR_INVALID|RIGHTS_REQUIRED)$/.test(code)) {
          return reply(400, "invalid_media_upload");
        }
        return reply(503, "media_unavailable");
      }
    },
    async playback(request: Request, organizationId: string, id: string): Promise<Response> {
      const actor = await authenticate(request, organizationId, id); if (actor instanceof Response) return actor;
      try {
        const asset = await storage.playback(organizationId, actor.accountId, id);
        if (!asset) return reply(404, "media_not_found");
        return new Response(new Uint8Array(asset.content), { headers: {
          ...headers, "content-type": asset.mime, "content-length": String(asset.content.byteLength),
          "content-disposition": "inline", "content-security-policy": "default-src 'none'; sandbox",
          "x-media-revision": String(asset.revision)
        } });
      } catch { return reply(503, "media_unavailable"); }
    },
    async revoke(request: Request, organizationId: string, id: string): Promise<Response> {
      const actor = await authenticate(request, organizationId, id); if (actor instanceof Response) return actor;
      try {
        return await storage.revoke(organizationId, actor.accountId, id)
          ? new Response(null, { status: 204, headers }) : reply(404, "media_not_found");
      } catch { return reply(503, "media_unavailable"); }
    }
  };
}

