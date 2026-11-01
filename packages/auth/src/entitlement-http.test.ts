import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError } from "./index.ts";
import { EntitlementService, type EntitlementGrant } from "./entitlements.ts";
import { createEntitlementGetHandler } from "./entitlement-http.ts";

const org = "11111111-1111-4111-8111-111111111111";
const account = "22222222-2222-4222-8222-222222222222";
const event = "33333333-3333-4333-8333-333333333333";
const principal = { organizationId: org, accountId: account, sessionId: "44444444-4444-4444-8444-444444444444" };
const request = (query = "capability=event.view&eventId=" + event) =>
  new Request("https://engine.example/api?" + query, { headers: { authorization: "Bearer fixture" } });
const grant: EntitlementGrant = { id: "55555555-5555-4555-8555-555555555555", version: 1,
  organizationId: org, accountId: account, eventId: event, capability: "event.view",
  source: "ticket", status: "active", startsAt: 0, expiresAt: null };
function fixture() {
  const state = { grants: [{ ...grant }], reads: 0, audits: 0, events: 0, owns: true,
    failure: "", authCode: "" as "" | "missing" | "expired" | "revoked" | "forbidden", tenant: org };
  const service = new EntitlementService({
    async listGrants(organizationId, accountId) {
      state.reads++;
      assert.equal(organizationId, org); assert.equal(accountId, account);
      if (state.failure === "storage") throw new Error("private database detail");
      return state.grants;
    }
  }, { async record() {
    state.audits++;
    if (state.failure === "audit") throw new Error("private audit detail");
  } });
  const handler = createEntitlementGetHandler({
    async authorize(header, organizationId) {
      assert.equal(header, "Bearer fixture"); assert.equal(organizationId, org);
      if (state.authCode) throw new AuthenticationError(state.authCode);
      if (state.failure === "authentication") throw new Error("private session detail");
      return { ...principal, organizationId: state.tenant };
    }
  }, service, async (organizationId, eventId) => {
    state.events++;
    assert.equal(organizationId, org); assert.equal(eventId, event);
    if (state.failure === "event") throw new Error("private event detail");
    return state.owns;
  });
  return { state, handler };
}

test("entitlement HTTP resolves authenticated account and returns minimal no-store result", async () => {
  const { state, handler } = fixture();
  const response = await handler(request(), org);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { allowed: true, reason: "active_grant" });
  assert.equal(state.reads, 1); assert.equal(state.audits, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Authorization");
});
for (const code of ["missing", "expired", "revoked", "forbidden"] as const) {
  test("entitlement HTTP rejects " + code + " before inspecting data", async () => {
    const { state, handler } = fixture(); state.authCode = code;
    const response = await handler(request(), org);
    assert.equal(response.status, code === "forbidden" ? 403 : 401);
    assert.equal(state.reads, 0); assert.equal(state.events, 0);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  });
}
test("entitlement HTTP denies an adapter's mismatched tenant", async () => {
  const { state, handler } = fixture(); state.tenant = account;
  assert.equal((await handler(request(), org)).status, 403);
  assert.equal(state.reads, 0);
});
for (const query of [
  "capability=event.view", "capability=event.view&eventId=bad", "capability=unknown",
  "capability=content.view&accountId=" + account,
  "capability=content.view&capability=staff.operate",
  "capability=content.view&eventId=" + event + "&eventId=" + event
]) {
  test("entitlement HTTP rejects malformed/client-selected scope " + query, async () => {
    const { state, handler } = fixture();
    assert.equal((await handler(request(query), org)).status, 400);
    assert.equal(state.reads, 0);
  });
}
test("entitlement HTTP rejects foreign event despite tenant-wide grant", async () => {
  const { state, handler } = fixture();
  state.grants[0] = { ...grant, source: "subscription", eventId: null }; state.owns = false;
  assert.equal((await handler(request(), org)).status, 404);
  assert.equal(state.reads, 0);
});
test("entitlement HTTP observes refund on next request and audits both outcomes", async () => {
  const { state, handler } = fixture();
  assert.equal((await (await handler(request(), org)).json()).allowed, true);
  state.grants[0]!.status = "refunded";
  assert.deepEqual(await (await handler(request(), org)).json(), { allowed: false, reason: "no_active_grant" });
  assert.equal(state.reads, 2); assert.equal(state.audits, 2);
});
for (const failure of ["storage", "audit", "event", "authentication", "malformed"]) {
  test("entitlement HTTP fails closed on " + failure, async () => {
    const { state, handler } = fixture(); state.failure = failure;
    if (failure === "malformed") state.grants[0]!.accountId = event;
    const response = await handler(request(), org);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "entitlement_unavailable" });
  });
}

