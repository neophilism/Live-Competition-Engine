import { z } from "zod";

export const featureKeySchema = z.enum([
  "ticketing", "entry_fees", "ppv", "subscriptions", "creator_memberships",
  "tips_gifts", "sponsorship", "advertising", "merchandise", "booking",
  "saas", "custom_domains", "analytics", "storage", "chat", "voting"
]);
export type FeatureKey = z.infer<typeof featureKeySchema>;
const id = z.string().uuid();
const flags = z.partialRecord(featureKeySchema, z.boolean());
const revision = z.number().int().nonnegative();
const platformSchema = z.object({ revision, flags }).strict();
const tenantSchema = z.object({ organizationId: id, revision, flags }).strict();
const eventSchema = tenantSchema.extend({ eventId: id }).strict();
const accountSchema = tenantSchema.extend({ accountId: id }).strict();

export const featurePolicySchema = z.object({
  platform: platformSchema,
  tenant: tenantSchema.optional(),
  event: eventSchema.optional(),
  account: accountSchema.optional()
}).strict();

export const featureContextSchema = z.object({
  organizationId: id,
  eventId: id.optional(),
  accountId: id.optional()
}).strict();

export type FeaturePolicy = z.infer<typeof featurePolicySchema>;
export type FeatureContext = z.infer<typeof featureContextSchema>;
export type FeatureScope = "platform" | "tenant" | "event" | "account";
export interface FeatureDecision {
  readonly feature: FeatureKey;
  readonly enabled: boolean;
  readonly reason: "enabled" | "not_enabled_at_platform" | "disabled_at_scope";
  readonly controllingScope: FeatureScope;
  readonly context: Readonly<FeatureContext>;
  readonly evaluatedScopes: ReadonlyArray<Readonly<{
    scope: FeatureScope;
    revision: number;
    value: boolean | null;
  }>>;
}
export interface FeatureDecisionAudit {
  // Must resolve only after the application has durably recorded the decision.
  record(decision: FeatureDecision): Promise<void>;
}

/**
 * Call only on the server with authenticated, authorized context and trusted
 * policy records. Flags never grant permissions, entitlements or legal consent.
 * Any explicit false is a veto; omitted settings inherit the platform default.
 */
export async function evaluateFeature(
  featureInput: unknown,
  contextInput: unknown,
  policyInput: unknown,
  audit: FeatureDecisionAudit
): Promise<FeatureDecision> {
  const feature = featureKeySchema.parse(featureInput);
  const context = featureContextSchema.parse(contextInput);
  const policy = featurePolicySchema.parse(policyInput);
  const layers: Array<{ scope: FeatureScope; revision: number; flags: Partial<Record<FeatureKey, boolean>> }> = [
    { scope: "platform", ...policy.platform }
  ];
  if (policy.tenant) {
    if (policy.tenant.organizationId !== context.organizationId) throw new Error("Feature tenant scope denied.");
    layers.push({ scope: "tenant", ...policy.tenant });
  }
  if (policy.event) {
    if (policy.event.organizationId !== context.organizationId || !context.eventId || policy.event.eventId !== context.eventId) {
      throw new Error("Feature event scope denied.");
    }
    layers.push({ scope: "event", ...policy.event });
  }
  if (policy.account) {
    if (policy.account.organizationId !== context.organizationId || !context.accountId || policy.account.accountId !== context.accountId) {
      throw new Error("Feature account scope denied.");
    }
    layers.push({ scope: "account", ...policy.account });
  }
  // Validate all supplied layers before evaluating, even when a parent is off.
  const evaluatedScopes = Object.freeze(layers.map(layer => Object.freeze({
    scope: layer.scope,
    revision: layer.revision,
    value: layer.flags[feature] ?? null
  })));
  const veto = evaluatedScopes.find(layer => layer.value === false);
  const platformEnabled = policy.platform.flags[feature] === true;
  const decision: FeatureDecision = Object.freeze({
    feature,
    enabled: platformEnabled && !veto,
    reason: !platformEnabled ? "not_enabled_at_platform" : veto ? "disabled_at_scope" : "enabled",
    controllingScope: !platformEnabled ? "platform" : veto?.scope ?? "platform",
    context: Object.freeze({ ...context }),
    evaluatedScopes
  });
  // Audit failure propagates: the caller must not act on an unrecorded decision.
  await audit.record(decision);
  return decision;
}

export async function requireFeature(
  feature: unknown, context: unknown, policy: unknown, audit: FeatureDecisionAudit
): Promise<FeatureDecision> {
  const decision = await evaluateFeature(feature, context, policy, audit);
  if (!decision.enabled) throw new Error("Feature disabled.");
  return decision;
}
