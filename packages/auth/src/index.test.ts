import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError, AuthenticationService, type AuthStore, type SessionRecord } from "./index.ts";

class MemoryStore implements AuthStore {
  epochs = new Map([["account-a", 0], ["account-b", 0]]);
  sessions = new Map<string, SessionRecord>();
  memberships = new Set(["account-a:org-a"]);
  recovery = new Map<string, { accountId: string; expiresAt: Date; used: boolean }>();

  async accountRecoveryEpoch(id: string) { return this.epochs.get(id) ?? null; }
  async findSession(hash: string) { return [...this.sessions.values()].find(x => x.tokenHash === hash) ?? null; }
  async saveSession(session: SessionRecord) { this.sessions.set(session.id, session); }
  async revokeSession(id: string, now: Date) { this.sessions.get(id)!.revokedAt = now; }
  async hasActiveMembership(accountId: string, organizationId: string) { return this.memberships.has(`${accountId}:${organizationId}`); }
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
  await expectCode(service.authorize(`Bearer ${second.token}`, "org-b", new Date(2001)), "forbidden");
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
