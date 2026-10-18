import type { EntitlementAudit, EntitlementDecision, EntitlementGrant, EntitlementStore } from "@live-competition-engine/auth/entitlements";
import { getSqlClient } from "./index.ts";

/** Trusted server adapter. Grant mutations belong to authorized provider/staff workflows. */
export class PostgresEntitlementStore implements EntitlementStore, EntitlementAudit {
  async listGrants(organizationId: string, accountId: string): Promise<EntitlementGrant[]> {
    const sql = getSqlClient();
    return sql<EntitlementGrant[]>`
      SELECT id, version, organization_id AS "organizationId", account_id AS "accountId",
        event_id AS "eventId", capability, source, status,
        starts_at::double precision AS "startsAt", expires_at::double precision AS "expiresAt"
      FROM entitlement_grants
      WHERE organization_id = ${organizationId} AND account_id = ${accountId}
      ORDER BY id LIMIT 1001
    `;
  }

  async record(decision: EntitlementDecision): Promise<void> {
    const sql = getSqlClient();
    await sql`
      INSERT INTO entitlement_decisions (
        organization_id, account_id, event_id, capability, allowed, reason,
        evaluated_at, grant_id, grant_version
      ) VALUES (
        ${decision.organizationId}, ${decision.accountId}, ${decision.eventId},
        ${decision.capability}, ${decision.allowed}, ${decision.reason},
        ${decision.evaluatedAt}, ${decision.grantId}, ${decision.grantVersion}
      )
    `;
  }
}
