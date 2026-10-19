import { describe, expect, it } from "vitest";
import { AuthenticationError, type AuthenticationService } from "@live-competition-engine/auth";
import { createFeatureHandlers } from "./handler";

const org = "00000000-0000-4000-8000-000000000001";
const account = "00000000-0000-4000-8000-000000000002";
const event = "00000000-0000-4000-8000-000000000003";

function fixture() {
  const calls: unknown[] = [];
  const authorizer: Pick<AuthenticationService, "authorize" | "authorizeAction"> = {
    async authorize(header, organizationId) {
      if (!header) throw new AuthenticationError("missing");
      calls.push(["read", organizationId]);
      return { accountId: account, sessionId: "session", organizationId };
    },
    async authorizeAction(header, action, scope) {
      if (!header) throw new AuthenticationError("missing");
      calls.push(["write", action, scope]);
      if (header === "Bearer denied") throw new AuthenticationError("forbidden");
      return { accountId: account, sessionId: "session", role: "tenant_operator",
        roleGrantId: "grant", roleGrantVersion: 1 };
    }
  };
  const handlers = createFeatureHandlers(authorizer,
    async input => { calls.push(["save", input]); return 3; },
    async (feature, context) => {
      calls.push(["evaluate", feature, context]);
      return { feature, enabled: false, reason: "not_enabled_at_platform",
        controllingScope: "platform", context, evaluatedScopes: [] };
    });
  return { handlers, calls };
}

const post = (body: unknown, auth = "Bearer valid") => new Request("https://example.test/api/feature-flags", {
  method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body)
});

describe("feature flag HTTP authorization", () => {
  it("requires tenant management and supplies the verified actor to storage", async () => {
    const { handlers, calls } = fixture();
    const response = await handlers.post(post({ scope: "tenant", organizationId: org,
      feature: "ticketing", enabled: false, expectedRevision: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 3 });
    expect(calls).toEqual([
      ["write", "tenant.manage", { organizationId: org }],
      ["save", { scope: "tenant", organizationId: org, eventId: undefined,
        accountId: undefined, feature: "ticketing", enabled: false,
        expectedRevision: 2, actorAccountId: account }]
    ]);
  });
  it("binds event policies to event-management scope", async () => {
    const { handlers, calls } = fixture();
    expect((await handlers.post(post({ scope: "event", organizationId: org,
      eventId: event, feature: "voting", enabled: true, expectedRevision: 0 }))).status).toBe(200);
    expect(calls[0]).toEqual(["write", "event.manage", { organizationId: org, competitionId: event }]);
  });
  it("denies missing credentials and forbidden roles without writing", async () => {
    const { handlers, calls } = fixture();
    const body = { scope: "tenant", organizationId: org, feature: "ticketing", enabled: true, expectedRevision: 0 };
    expect((await handlers.post(post(body, ""))).status).toBe(401);
    expect((await handlers.post(post(body, "Bearer denied"))).status).toBe(403);
    expect(calls.some(row => Array.isArray(row) && row[0] === "save")).toBe(false);
  });
  it("rejects malformed updates before authorization", async () => {
    const { handlers, calls } = fixture();
    expect((await handlers.post(post({ scope: "platform", feature: "unknown", enabled: true, expectedRevision: 0 }))).status).toBe(400);
    expect((await handlers.post(post({ scope: "tenant", feature: "voting", enabled: "true", expectedRevision: 0 }))).status).toBe(400);
    expect(calls).toEqual([]);
  });
  it("uses the authenticated account on reads rather than a query claim", async () => {
    const { handlers, calls } = fixture();
    const response = await handlers.get(new Request(`https://example.test/api/feature-flags?organizationId=${org}&feature=ticketing&accountId=forged`, {
      headers: { authorization: "Bearer valid" }
    }));
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      ["read", org],
      ["evaluate", "ticketing", { organizationId: org, eventId: undefined, accountId: account }]
    ]);
  });
});
