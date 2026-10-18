import type { Principal } from "./index.ts";

export const entitlementCapabilities = ["event.view", "event.enter", "content.view", "staff.operate"] as const;
export type EntitlementCapability = (typeof entitlementCapabilities)[number];
export interface EntitlementGrant {
  id: string;
  version: 1;
  organizationId: string;
  accountId: string;
  eventId: string | null;
  capability: EntitlementCapability;
  source: "ticket" | "subscription" | "staff" | "manual";
  status: "active" | "pending" | "refunded" | "revoked";
  startsAt: number;
  expiresAt: number | null;
}
export interface EntitlementStore {
  // Read current records; propagate read failures. Filter by BOTH identifiers.
  listGrants(organizationId: string, accountId: string): Promise<readonly EntitlementGrant[]>;
}
export interface EntitlementRequest {
  organizationId: string;
  eventId?: string;
  capability: EntitlementCapability;
}
export interface EntitlementDecision {
  readonly allowed: boolean;
  readonly reason: "active_grant" | "no_active_grant";
  readonly organizationId: string;
  readonly accountId: string;
  readonly eventId: string | null;
  readonly capability: EntitlementCapability;
  readonly evaluatedAt: number;
  readonly grantId: string | null;
  readonly grantVersion: 1 | null;
}
export interface EntitlementAudit {
  record(decision: EntitlementDecision): Promise<void>;
}
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Authorization and feature guards remain separate requirements. No cached grants. */
export class EntitlementService {
  private readonly store: EntitlementStore;
  private readonly audit: EntitlementAudit;
  constructor(store: EntitlementStore, audit: EntitlementAudit) {
    this.store = store;
    this.audit = audit;
  }

  async resolve(principal: Principal, request: EntitlementRequest, now = Date.now()): Promise<EntitlementDecision> {
    if (!identifier(principal.accountId) || !identifier(principal.sessionId) ||
      !identifier(request.organizationId) || principal.organizationId !== request.organizationId ||
      (request.eventId !== undefined && !identifier(request.eventId)) ||
      !entitlementCapabilities.includes(request.capability) || !validTime(now)) {
      throw new Error("Entitlement scope denied.");
    }
    // Snapshot request identifiers before awaiting storage to prevent mutation races.
    const organizationId = request.organizationId;
    const accountId = principal.accountId;
    const eventId = request.eventId ?? null;
    const capability = request.capability;
    const grants = await this.store.listGrants(organizationId, accountId);
    if (!Array.isArray(grants) || grants.length > 1000) throw new Error("Invalid entitlement records.");
    const seen = new Set<string>();
    // Reject malformed or out-of-scope storage data, including unknown versions.
    for (const grant of grants) {
      if (!grant || !identifier(grant.id) || seen.has(grant.id) || grant.version !== 1 ||
        grant.organizationId !== organizationId || grant.accountId !== accountId ||
        (grant.eventId !== null && !identifier(grant.eventId)) ||
        !entitlementCapabilities.includes(grant.capability) ||
        !["ticket", "subscription", "staff", "manual"].includes(grant.source) ||
        !["active", "pending", "refunded", "revoked"].includes(grant.status) ||
        !validTime(grant.startsAt) ||
        (grant.expiresAt !== null && (!validTime(grant.expiresAt) || grant.expiresAt <= grant.startsAt)) ||
        (grant.source === "ticket" && grant.eventId === null) ||
        (grant.capability === "staff.operate" && grant.source !== "staff") ||
        (grant.source === "staff" && grant.capability !== "staff.operate")) {
        throw new Error("Invalid entitlement records.");
      }
      seen.add(grant.id);
    }
    const matches = grants.filter(grant =>
      grant.capability === capability && grant.status === "active" &&
      grant.startsAt <= now && (grant.expiresAt === null || now < grant.expiresAt) &&
      (grant.eventId === null || grant.eventId === eventId)
    ).sort((a, b) => a.id.localeCompare(b.id));
    const match = matches[0];
    const decision: EntitlementDecision = Object.freeze({
      allowed: !!match,
      reason: match ? "active_grant" : "no_active_grant",
      organizationId, accountId, eventId, capability, evaluatedAt: now,
      grantId: match?.id ?? null, grantVersion: match ? 1 : null
    });
    await this.audit.record(decision);
    return decision;
  }

  async require(principal: Principal, request: EntitlementRequest, now = Date.now()): Promise<EntitlementDecision> {
    const decision = await this.resolve(principal, request, now);
    if (!decision.allowed) throw new Error("Entitlement required.");
    return decision;
  }
}
