import { test } from "node:test";
import assert from "node:assert/strict";
import { EntitlementService, type EntitlementGrant } from "./entitlements.ts";

const ids = Array.from({ length: 6 }, (_, i) => "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"));
const [organizationId, accountId, sessionId, eventId, grantId, otherId] = ids as [string, string, string, string, string, string];
const principal = { organizationId, accountId, sessionId };
const request = { organizationId, eventId, capability: "event.view" as const };
const base: EntitlementGrant = { id: grantId, version: 1, organizationId, accountId, eventId,
  capability: "event.view", source: "ticket", status: "active", startsAt: 100, expiresAt: 200 };
const service = (grants: EntitlementGrant[]) => new EntitlementService({ listGrants: async () => grants }, { record: async () => {} });

test("ticket boundaries, status and scope fail closed", async () => {
  for (const status of ["active", "pending", "refunded", "revoked"] as const) {
    for (const now of [99, 100, 199, 200]) {
      const result = await service([{ ...base, status }]).resolve(principal, request, now);
      assert.equal(result.allowed, status === "active" && now >= 100 && now < 200);
    }
  }
  assert.equal((await service([base]).resolve(principal, { ...request, eventId: otherId }, 150)).allowed, false);
  assert.equal((await service([base]).resolve(principal, { organizationId, capability: "event.view" }, 150)).allowed, false);
  assert.equal((await service([]).resolve(principal, request, 150)).allowed, false);
});

test("subscriptions, manual grants and staff remain capability-specific", async () => {
  for (const source of ["subscription", "manual"] as const) {
    const grant = { ...base, source, eventId: null, expiresAt: null };
    assert.equal((await service([grant]).resolve(principal, request, 200)).allowed, true);
    assert.equal((await service([grant]).resolve(principal, { ...request, capability: "staff.operate" }, 200)).allowed, false);
  }
  const grant = { ...base, source: "staff" as const, capability: "staff.operate" as const };
  assert.equal((await service([grant]).resolve(principal, { ...request, capability: "staff.operate" }, 150)).allowed, true);
});

test("cross-account/tenant, duplicate and malformed storage records are rejected", async () => {
  for (const change of [
    { organizationId: otherId }, { accountId: otherId }, { startsAt: NaN }, { expiresAt: 100 },
    { version: 2 }, { eventId: null }, { capability: "staff.operate" }, { source: "untrusted" }
  ]) {
    await assert.rejects(() => service([{ ...base, ...change } as EntitlementGrant]).resolve(principal, request, 150), /Invalid entitlement/);
  }
  await assert.rejects(() => service([base, base]).resolve(principal, request, 150), /Invalid entitlement/);
  await assert.rejects(() => service([base]).resolve({ ...principal, organizationId: otherId }, request, 150), /scope denied/);
  await assert.rejects(() => service([base]).resolve(principal, request, NaN), /scope denied/);
});

test("current storage is read on every decision and refund revokes the grant", async () => {
  let status: EntitlementGrant["status"] = "active";
  let reads = 0;
  const svc = new EntitlementService({ listGrants: async () => { reads++; return [{ ...base, status }]; } }, { record: async () => {} });
  assert.equal((await svc.require(principal, request, 150)).allowed, true);
  status = "refunded";
  await assert.rejects(() => svc.require(principal, request, 150), /Entitlement required/);
  assert.equal(reads, 2);
});

test("audit evidence is immutable and storage/audit failures propagate", async () => {
  const records: unknown[] = [];
  const svc = new EntitlementService({ listGrants: async () => [base] }, { record: async d => { records.push(d); } });
  const decision = await svc.resolve(principal, request, 150);
  assert.deepEqual(records, [decision]);
  assert.equal(decision.grantId, grantId);
  assert.equal(Object.isFrozen(decision), true);
  const brokenStore = new EntitlementService({ listGrants: async () => { throw new Error("storage offline"); } }, { record: async () => {} });
  await assert.rejects(() => brokenStore.resolve(principal, request, 150), /storage offline/);
  const brokenAudit = new EntitlementService({ listGrants: async () => [base] }, { record: async () => { throw new Error("audit offline"); } });
  await assert.rejects(() => brokenAudit.require(principal, request, 150), /audit offline/);
});
