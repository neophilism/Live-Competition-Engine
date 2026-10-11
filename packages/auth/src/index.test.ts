import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthenticationError,
  AuthenticationService,
  type AuthStore,
  type CompetitionRole,
  type ProtectedAction,
  type RoleGrantRecord,
  type SessionRecord
} from "./index.ts";

class MemoryStore implements AuthStore {
  epochs = new Map([["account-a", 0], ["account-b", 0]]);
  sessions = new Map<string, SessionRecord>();
  memberships = new Set(["account-a:org-a", "account-a:org-b"]);
  recovery = new Map<string, { accountId: string; expiresAt: Date; used: boolean }>();
  grants: RoleGrantRecord[] = [];

  async accountRecoveryEpoch(id: string) { return this.epochs.get(id) ?? null; }
  async findSession(hash: string) { return [...this.sessions.values()].find(x => x.tokenHash === hash) ?? null; }
  async saveSession(session: SessionRecord) { this.sessions.set(session.id, session); }
  async revokeSession(id: string, now: Date) { this.sessions.get(id)!.revokedAt = now; }
  async hasActiveMembership(accountId: string, organizationId: string) { return this.memberships.has(`${accountId}:${organizationId}`); }
  async listRoleGrants(accountId: string) { return this.grants.filter(grant => grant.accountId === accountId); }
  async replaceRecoveryCodes(accountId: string, codes: Array<{ codeHash: string; expiresAt: Date }>) {
    for (const [hash, row] of this.recovery) if (row.accountId === accountId) this.recovery.delete(hash);
    for (const code of codes) this.recovery.set(code.codeHash, { accountId, expiresAt: code.expiresAt, used: false });
  }
  async consumeRecoveryAndRevokeSessions(accountId: string, hash: string, now: Date) {
    const row = this.recovery.get(hash);
    if (!row || row.accountId !== accountId || row.used || row.expiresAt <= now) return false;
    row.used = true;
    this.epochs.set(accountId, (this.epochs.get(accountId) ?? 0) + 1);
    for (const session of this.sessions.values()) if (session.accountId === accountId && !session.revokedAt) session.revokedAt = now;
    return true;
  }
}

const expectCode = async (promise: Promise<unknown>, code: AuthenticationError["code"]) =>
  assert.rejects(promise, (error: unknown) => error instanceof AuthenticationError && error.code === code);

const roleGrant = (
  role: CompetitionRole,
  organizationId: string | null,
  competitionId: string | null,
  overrides: Partial<RoleGrantRecord> = {}
): RoleGrantRecord => ({
  id: `${role}-${organizationId}-${competitionId}`,
  accountId: "account-a",
  role,
  version: 1,
  organizationId,
  competitionId,
  grantedAt: new Date("2026-10-10T00:00:00Z"),
  expiresAt: null,
  revokedAt: null,
  ...overrides
});

test("stores only a domain-separated token digest and authorizes an active member", async () => {
  const store = new MemoryStore();
  const service = new AuthenticationService(store);
  const { token, session } = await service.issueSession("account-a", new Date("2026-10-10T00:00:00Z"));
  assert.equal(token.length, 43);
  assert.doesNotMatch(session.tokenHash, new RegExp(token));
  assert.deepEqual(await service.authorize(`Bearer ${token}`, "org-a", new Date("2026-10-10T00:01:00Z")), {
    accountId: "account-a", sessionId: session.id, organizationId: "org-a"
  });
});

test("fails closed for malformed, expired, revoked and cross-organization requests", async () => {
  const store = new MemoryStore();
  const service = new AuthenticationService(store, 1000);
  await expectCode(service.authorize(null), "missing");
  await expectCode(service.authorize("Basic nope"), "invalid");
  const first = await service.issueSession("account-a", new Date(0));
  await expectCode(service.authorize(`Bearer ${first.token}`, undefined, new Date(1000)), "expired");
  const second = await service.issueSession("account-a", new Date(2000));
  await expectCode(service.authorize(`Bearer ${second.token}`, "org-c", new Date(2001)), "forbidden");
  await service.revoke(second.token, new Date(2002));
  await expectCode(service.authorize(`Bearer ${second.token}`, undefined, new Date(2003)), "revoked");
});

test("one-time recovery revokes every prior session and cannot be replayed", async () => {
  const store = new MemoryStore();
  const service = new AuthenticationService(store);
  const old = await service.issueSession("account-a", new Date("2026-10-10T00:00:00Z"));
  const [code] = await service.createRecoveryCodes("account-a", 1, new Date("2026-10-10T00:00:00Z"));
  const replacement = await service.recover("account-a", code!, new Date("2026-10-10T00:01:00Z"));
  await expectCode(service.authorize(`Bearer ${old.token}`, undefined, new Date("2026-10-10T00:02:00Z")), "revoked");
  await service.authorize(`Bearer ${replacement.token}`, undefined, new Date("2026-10-10T00:02:00Z"));
  await expectCode(service.recover("account-a", code!, new Date("2026-10-10T00:03:00Z")), "invalid");
});

test("authorizes each role only for its declared action and scope", async () => {
  const cases: Array<{
    role: CompetitionRole;
    action: ProtectedAction;
    organizationId?: string;
    competitionId?: string;
  }> = [
    { role: "platform_operator", action: "platform.manage" },
    { role: "tenant_operator", action: "tenant.manage", organizationId: "org-a" },
    { role: "event_producer", action: "event.manage", organizationId: "org-a", competitionId: "competition-a" },
    { role: "performer", action: "performance.submit", organizationId: "org-a", competitionId: "competition-a" },
    { role: "judge", action: "judging.score", organizationId: "org-a", competitionId: "competition-a" },
    { role: "viewer", action: "content.view_private", organizationId: "org-a" },
    { role: "industry_scout", action: "industry.discover", organizationId: "org-a" }
  ];

  for (const item of cases) {
    const store = new MemoryStore();
    store.grants.push(roleGrant(item.role, item.organizationId ?? null, item.competitionId ?? null));
    const service = new AuthenticationService(store);
    const { token } = await service.issueSession("account-a", new Date("2026-10-10T00:00:00Z"));
    const principal = await service.authorizeAction(
      `Bearer ${token}`,
      item.action,
      { organizationId: item.organizationId, competitionId: item.competitionId },
      new Date("2026-10-10T00:01:00Z")
    );
    assert.equal(principal.role, item.role);
    assert.equal(principal.roleGrantVersion, 1);
  }
});

test("denies cross-role, cross-tenant and cross-competition actions", async () => {
  const store = new MemoryStore();
  store.grants.push(roleGrant("judge", "org-a", "competition-a"));
  const service = new AuthenticationService(store);
  const { token } = await service.issueSession("account-a", new Date("2026-10-10T00:00:00Z"));
  const header = `Bearer ${token}`;
  const now = new Date("2026-10-10T00:01:00Z");
  await expectCode(service.authorizeAction(header, "performance.submit", { organizationId: "org-a", competitionId: "competition-a" }, now), "forbidden");
  await expectCode(service.authorizeAction(header, "judging.score", { organizationId: "org-b", competitionId: "competition-a" }, now), "forbidden");
  await expectCode(service.authorizeAction(header, "judging.score", { organizationId: "org-a", competitionId: "competition-b" }, now), "forbidden");
});

test("rejects revoked, expired, future, malformed-scope and unknown-version grants", async () => {
  const now = new Date("2026-10-10T00:01:00Z");
  const invalid = [
    roleGrant("judge", "org-a", "competition-a", { revokedAt: now }),
    roleGrant("judge", "org-a", "competition-a", { expiresAt: now }),
    roleGrant("judge", "org-a", "competition-a", { grantedAt: new Date("2026-10-10T00:02:00Z") }),
    roleGrant("judge", "org-a", null),
    roleGrant("judge", "org-a", "competition-a", { version: 2 })
  ];
  for (const grant of invalid) {
    const store = new MemoryStore();
    store.grants.push(grant);
    const service = new AuthenticationService(store);
    const { token } = await service.issueSession("account-a", new Date("2026-10-10T00:00:00Z"));
    await expectCode(service.authorizeAction(`Bearer ${token}`, "judging.score", {
      organizationId: "org-a", competitionId: "competition-a"
    }, now), "forbidden");
  }
});
