import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface SessionRecord {
  id: string;
  accountId: string;
  tokenHash: string;
  recoveryEpoch: number;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthStore {
  accountRecoveryEpoch(accountId: string): Promise<number | null>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  saveSession(session: SessionRecord): Promise<void>;
  revokeSession(id: string, revokedAt: Date): Promise<void>;
  replaceRecoveryCodes(accountId: string, codes: Array<{ codeHash: string; expiresAt: Date }>): Promise<void>;
  consumeRecoveryAndRevokeSessions(accountId: string, codeHash: string, now: Date): Promise<boolean>;
  hasActiveMembership(accountId: string, organizationId: string): Promise<boolean>;
}

export interface Principal {
  accountId: string;
  sessionId: string;
  organizationId?: string;
}

export class AuthenticationError extends Error {
  constructor(public readonly code: "missing" | "invalid" | "expired" | "revoked" | "forbidden") {
    super(`Authentication failed: ${code}`);
  }
}

const digest = (kind: "session" | "recovery", value: string) =>
  createHash("sha256").update(`${kind}\0${value}`, "utf8").digest("hex");

export class AuthenticationService {
  constructor(
    private readonly store: AuthStore,
    private readonly sessionLifetimeMs = 1000 * 60 * 60 * 24,
    private readonly recoveryLifetimeMs = 1000 * 60 * 60 * 24 * 30
  ) {
    if (sessionLifetimeMs <= 0 || sessionLifetimeMs > 1000 * 60 * 60 * 24 * 30) {
      throw new RangeError("session lifetime must be between one millisecond and 30 days");
    }
  }

  async issueSession(accountId: string, now = new Date()): Promise<{ token: string; session: SessionRecord }> {
    const recoveryEpoch = await this.store.accountRecoveryEpoch(accountId);
    if (recoveryEpoch === null) throw new AuthenticationError("invalid");
    const token = randomBytes(32).toString("base64url");
    const session: SessionRecord = {
      id: randomUUID(),
      accountId,
      tokenHash: digest("session", token),
      recoveryEpoch,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.sessionLifetimeMs),
      revokedAt: null
    };
    await this.store.saveSession(session);
    return { token, session };
  }

  async authorize(header: string | null, organizationId?: string, now = new Date()): Promise<Principal> {
    if (!header) throw new AuthenticationError("missing");
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
    if (!match) throw new AuthenticationError("invalid");
    const session = await this.store.findSession(digest("session", match[1]!));
    if (!session) throw new AuthenticationError("invalid");
    if (session.revokedAt) throw new AuthenticationError("revoked");
    if (session.expiresAt.getTime() <= now.getTime()) throw new AuthenticationError("expired");
    const recoveryEpoch = await this.store.accountRecoveryEpoch(session.accountId);
    if (recoveryEpoch === null || recoveryEpoch !== session.recoveryEpoch) throw new AuthenticationError("revoked");
    if (organizationId && !(await this.store.hasActiveMembership(session.accountId, organizationId))) {
      throw new AuthenticationError("forbidden");
    }
    return { accountId: session.accountId, sessionId: session.id, ...(organizationId ? { organizationId } : {}) };
  }

  async revoke(token: string, now = new Date()): Promise<void> {
    const session = await this.store.findSession(digest("session", token));
    if (session && !session.revokedAt) await this.store.revokeSession(session.id, now);
  }

  async createRecoveryCodes(accountId: string, count = 8, now = new Date()): Promise<string[]> {
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new RangeError("recovery code count must be 1..20");
    const codes = Array.from({ length: count }, () => randomBytes(18).toString("base64url"));
    const expiresAt = new Date(now.getTime() + this.recoveryLifetimeMs);
    await this.store.replaceRecoveryCodes(accountId, codes.map(code => ({ codeHash: digest("recovery", code), expiresAt })));
    return codes;
  }

  async recover(accountId: string, code: string, now = new Date()): Promise<{ token: string; session: SessionRecord }> {
    if (!/^[A-Za-z0-9_-]{24}$/.test(code)) throw new AuthenticationError("invalid");
    const consumed = await this.store.consumeRecoveryAndRevokeSessions(accountId, digest("recovery", code), now);
    if (!consumed) throw new AuthenticationError("invalid");
    return this.issueSession(accountId, now);
  }
}
