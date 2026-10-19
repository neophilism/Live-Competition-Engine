import {
  evaluateFeature,
  featureKeySchema,
  type FeatureContext,
  type FeatureDecision,
  type FeatureKey,
  type FeatureScope
} from "@live-competition-engine/config/features";
import { getSqlClient } from "./index.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeatureFlagUpdate {
  scope: FeatureScope;
  organizationId?: string;
  eventId?: string;
  accountId?: string;
  feature: FeatureKey;
  enabled: boolean;
  expectedRevision: number;
  actorAccountId: string;
}

function key(scope: FeatureScope, organizationId?: string, eventId?: string, accountId?: string): string {
  if (scope === "platform") return "platform";
  if (scope === "tenant") return `tenant:${organizationId}`;
  if (scope === "event") return `event:${eventId}`;
  return `account:${organizationId}:${accountId}`;
}

function validateUpdate(input: FeatureFlagUpdate): void {
  featureKeySchema.parse(input.feature);
  if (typeof input.enabled !== "boolean" || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !uuid.test(input.actorAccountId)) throw new Error("Invalid feature update.");
  if (input.scope === "platform") {
    if (input.organizationId || input.eventId || input.accountId) throw new Error("Invalid platform scope.");
  } else if (!input.organizationId || !uuid.test(input.organizationId)) {
    throw new Error("Invalid tenant scope.");
  }
  if (input.scope === "event") {
    if (!input.eventId || !uuid.test(input.eventId) || input.accountId) throw new Error("Invalid event scope.");
  } else if (input.eventId) throw new Error("Unexpected event scope.");
  if (input.scope === "account") {
    if (!input.accountId || !uuid.test(input.accountId)) throw new Error("Invalid account scope.");
  } else if (input.accountId) throw new Error("Unexpected account scope.");
}

/** Persist a single authorized setting. The HTTP caller must authorize platform,
 * tenant or event management before calling. Revision compare prevents lost updates. */
export async function setFeatureFlag(input: FeatureFlagUpdate): Promise<number> {
  validateUpdate(input);
  const sql = getSqlClient();
  return sql.begin(async tx => {
    if (input.scope === "event") {
      const rows = await tx`SELECT 1 FROM competitions WHERE id = ${input.eventId!} AND organization_id = ${input.organizationId!}`;
      if (rows.length !== 1) throw new Error("Feature event scope denied.");
    } else if (input.scope === "account") {
      const rows = await tx`SELECT 1 FROM organization_memberships WHERE account_id = ${input.accountId!} AND organization_id = ${input.organizationId!} AND status = 'active'`;
      if (rows.length !== 1) throw new Error("Feature account scope denied.");
    } else if (input.scope === "tenant") {
      const rows = await tx`SELECT 1 FROM organizations WHERE id = ${input.organizationId!}`;
      if (rows.length !== 1) throw new Error("Feature tenant scope denied.");
    }
    const scopeKey = key(input.scope, input.organizationId, input.eventId, input.accountId);
    const rows = await tx<{ revision: number }[]>`
      INSERT INTO feature_flags (scope_key, feature, scope, organization_id, event_id, account_id,
        enabled, revision, updated_by_account_id)
      VALUES (${scopeKey}, ${input.feature}, ${input.scope}, ${input.organizationId ?? null},
        ${input.eventId ?? null}, ${input.accountId ?? null}, ${input.enabled}, 1, ${input.actorAccountId})
      ON CONFLICT (scope_key, feature) DO UPDATE SET
        enabled = EXCLUDED.enabled, revision = feature_flags.revision + 1,
        updated_by_account_id = EXCLUDED.updated_by_account_id, updated_at = now()
      WHERE feature_flags.revision = ${input.expectedRevision}
      RETURNING revision
    `;
    // A newly inserted row is valid only when the caller expected no record.
    if (rows.length !== 1 || (rows[0]!.revision === 1 && input.expectedRevision !== 0)) {
      throw new Error("Feature policy revision conflict.");
    }
    return rows[0]!.revision;
  });
}

/** Read exactly the supplied, server-authorized scopes and commit an audit entry
 * in the same transaction. Storage or audit failure prevents the decision. */
export async function evaluateStoredFeature(feature: FeatureKey, context: FeatureContext): Promise<FeatureDecision> {
  featureKeySchema.parse(feature);
  if (!uuid.test(context.organizationId) || (context.eventId && !uuid.test(context.eventId)) ||
      (context.accountId && !uuid.test(context.accountId))) throw new Error("Invalid feature context.");
  const sql = getSqlClient();
  return sql.begin(async tx => {
    if (context.eventId) {
      const event = await tx`SELECT 1 FROM competitions WHERE id = ${context.eventId} AND organization_id = ${context.organizationId}`;
      if (event.length !== 1) throw new Error("Feature event scope denied.");
    }
    if (context.accountId) {
      const member = await tx`SELECT 1 FROM organization_memberships WHERE account_id = ${context.accountId} AND organization_id = ${context.organizationId} AND status = 'active'`;
      if (member.length !== 1) throw new Error("Feature account scope denied.");
    }
    const keys = ["platform", key("tenant", context.organizationId),
      context.eventId ? key("event", context.organizationId, context.eventId) : "",
      context.accountId ? key("account", context.organizationId, undefined, context.accountId) : ""];
    const rows = await tx<{ scope: FeatureScope; enabled: boolean; revision: number }[]>`
      SELECT scope, enabled, revision FROM feature_flags
      WHERE feature = ${feature} AND scope_key IN (${keys[0]}, ${keys[1]}, ${keys[2]}, ${keys[3]})
      FOR SHARE
    `;
    const byScope = new Map(rows.map(row => [row.scope, row]));
    const layer = (scope: FeatureScope) => ({ revision: byScope.get(scope)?.revision ?? 0,
      flags: byScope.has(scope) ? { [feature]: byScope.get(scope)!.enabled } : {} });
    return evaluateFeature(feature, context, {
      platform: layer("platform"),
      tenant: { organizationId: context.organizationId, ...layer("tenant") },
      ...(context.eventId ? { event: { organizationId: context.organizationId, eventId: context.eventId, ...layer("event") } } : {}),
      ...(context.accountId ? { account: { organizationId: context.organizationId, accountId: context.accountId, ...layer("account") } } : {})
    }, { record: async decision => {
      await tx`
        INSERT INTO feature_decision_audit (feature, organization_id, event_id, account_id,
          enabled, reason, controlling_scope, policy_revisions)
        VALUES (${feature}, ${context.organizationId}, ${context.eventId ?? null},
          ${context.accountId ?? null}, ${decision.enabled}, ${decision.reason},
          ${decision.controllingScope}, ${tx.json(decision.evaluatedScopes)})
      `;
    } });
  });
}
