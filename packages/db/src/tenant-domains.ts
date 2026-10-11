import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { getSqlClient } from "./index.ts";

const CHALLENGE_PREFIX = "lce-domain-verification=";
const CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;
const reservedSuffixes = [".example", ".invalid", ".localhost", ".local", ".test", ".internal"];

export interface DomainClaim {
  id: string;
  domain: string;
  status: "pending" | "verified";
  dnsChallenge?: { name: string; value: string };
}

export interface DomainVerification {
  id: string;
  domain: string;
  status: "verified" | "proof_missing" | "challenge_expired";
}

export interface TenantDomainContext {
  organizationId: string;
  domain: string;
}

export function canonicalizeTenantDomain(input: string): string {
  const candidate = input.trim().replace(/\.$/, "").toLowerCase();
  const domain = domainToASCII(candidate);
  const labels = domain.split(".");
  if (
    domain.length < 4 ||
    domain.length > 253 ||
    isIP(domain) !== 0 ||
    labels.length < 2 ||
    labels.some(label => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ||
    reservedSuffixes.some(suffix => domain === suffix.slice(1) || domain.endsWith(suffix))
  ) {
    throw new RangeError("invalid custom domain");
  }
  return domain;
}

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export async function claimTenantDomain(
  organizationId: string,
  accountId: string,
  input: string
): Promise<DomainClaim | null> {
  const domain = canonicalizeTenantDomain(input);
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const sql = getSqlClient();

  return sql.begin(async tx => {
    const organizations = await tx<{ id: string }[]>`
      SELECT id FROM organizations WHERE id = ${organizationId} FOR SHARE
    `;
    if (organizations.length !== 1) return null;

    const [existing] = await tx<{ id: string; organization_id: string; status: string }[]>`
      SELECT id, organization_id, status
      FROM organization_domains
      WHERE domain = ${domain}
      FOR UPDATE
    `;
    if (existing && existing.organization_id !== organizationId) return null;
    if (existing?.status === "verified") {
      return { id: existing.id, domain, status: "verified" };
    }

    const id = existing?.id ?? randomUUID();
    if (existing) {
      await tx`
        UPDATE organization_domains
        SET verification_token_hash = ${tokenHash}, challenge_created_at = now(),
          claimed_by_account_id = ${accountId}, updated_at = now()
        WHERE id = ${id} AND organization_id = ${organizationId} AND status = 'pending'
      `;
    } else {
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO organization_domains (
          id, organization_id, domain, verification_token_hash, claimed_by_account_id
        ) VALUES (${id}, ${organizationId}, ${domain}, ${tokenHash}, ${accountId})
        ON CONFLICT (domain) DO NOTHING
        RETURNING id
      `;
      if (inserted.length !== 1) return null;
    }

    return {
      id,
      domain,
      status: "pending",
      dnsChallenge: {
        name: `_lce-domain.${domain}`,
        value: `${CHALLENGE_PREFIX}${token}`
      }
    };
  });
}

export async function getTenantDomainChallenge(
  organizationId: string,
  domainId: string
): Promise<{ domain: string; tokenHash: string; createdAt: Date } | null> {
  const sql = getSqlClient();
  const [row] = await sql<{ domain: string; verification_token_hash: string; challenge_created_at: Date }[]>`
    SELECT domain, verification_token_hash, challenge_created_at
    FROM organization_domains
    WHERE id = ${domainId} AND organization_id = ${organizationId} AND status = 'pending'
  `;
  return row ? {
    domain: row.domain,
    tokenHash: row.verification_token_hash,
    createdAt: row.challenge_created_at
  } : null;
}

export async function verifyTenantDomain(
  organizationId: string,
  domainId: string,
  accountId: string,
  txtRecords: readonly (readonly string[])[],
  now = new Date()
): Promise<DomainVerification | null> {
  const sql = getSqlClient();
  return sql.begin(async tx => {
    const [row] = await tx<{ domain: string; verification_token_hash: string; challenge_created_at: Date; status: string }[]>`
      SELECT domain, verification_token_hash, challenge_created_at, status
      FROM organization_domains
      WHERE id = ${domainId} AND organization_id = ${organizationId}
      FOR UPDATE
    `;
    if (!row) return null;
    if (row.status === "verified") return { id: domainId, domain: row.domain, status: "verified" };
    if (row.status !== "pending") return null;
    if (now.getTime() - row.challenge_created_at.getTime() > CHALLENGE_TTL_MS) {
      return { id: domainId, domain: row.domain, status: "challenge_expired" };
    }

    const proved = txtRecords
      .map(parts => parts.join("").trim())
      .filter(value => value.startsWith(CHALLENGE_PREFIX))
      .some(value => hashToken(value.slice(CHALLENGE_PREFIX.length)) === row.verification_token_hash);
    if (!proved) return { id: domainId, domain: row.domain, status: "proof_missing" };

    await tx`
      UPDATE organization_domains
      SET status = 'verified', verified_by_account_id = ${accountId},
        verified_at = ${now}, updated_at = ${now}
      WHERE id = ${domainId} AND organization_id = ${organizationId} AND status = 'pending'
    `;
    return { id: domainId, domain: row.domain, status: "verified" };
  });
}

export async function resolveTenantDomain(input: string): Promise<TenantDomainContext | null> {
  let domain: string;
  try {
    domain = canonicalizeTenantDomain(input);
  } catch {
    return null;
  }
  const sql = getSqlClient();
  const [row] = await sql<{ organization_id: string; domain: string }[]>`
    SELECT organization_id, domain
    FROM organization_domains
    WHERE domain = ${domain} AND status = 'verified'
  `;
  return row ? { organizationId: row.organization_id, domain: row.domain } : null;
}
