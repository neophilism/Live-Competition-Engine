import type {
  AuthStore,
  CompetitionRole,
  RoleGrantRecord,
  SessionRecord
} from "@live-competition-engine/auth";
import { getSqlClient } from "./index";

interface SessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  recovery_epoch: number;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

interface RoleGrantRow {
  id: string;
  account_id: string;
  role: CompetitionRole;
  version: number;
  organization_id: string | null;
  competition_id: string | null;
  granted_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
}

const toSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  accountId: row.account_id,
  tokenHash: row.token_hash,
  recoveryEpoch: row.recovery_epoch,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at
});

const toRoleGrant = (row: RoleGrantRow): RoleGrantRecord => ({
  id: row.id,
  accountId: row.account_id,
  role: row.role,
  version: row.version,
  organizationId: row.organization_id,
  competitionId: row.competition_id,
  grantedAt: row.granted_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at
});

export function createPostgresAuthStore(): AuthStore {
  const sql = getSqlClient();

  return {
    async accountRecoveryEpoch(accountId) {
      const [row] = await sql<{ recovery_epoch: number }[]>\`
        SELECT recovery_epoch
        FROM accounts
        WHERE id = \${accountId} AND disabled_at IS NULL
      \`;
      return row?.recovery_epoch ?? null;
    },

    async findSession(tokenHash) {
      const [row] = await sql<SessionRow[]>\`
        SELECT id, account_id, token_hash, recovery_epoch, created_at, expires_at, revoked_at
        FROM auth_sessions
        WHERE token_hash = \${tokenHash}
      \`;
      return row ? toSession(row) : null;
    },

    async saveSession(session) {
      await sql\`
        INSERT INTO auth_sessions (
          id, account_id, token_hash, recovery_epoch, created_at, expires_at, last_seen_at, revoked_at
        ) VALUES (
          \${session.id}, \${session.accountId}, \${session.tokenHash}, \${session.recoveryEpoch},
          \${session.createdAt}, \${session.expiresAt}, \${session.createdAt}, \${session.revokedAt}
        )
      \`;
    },

    async revokeSession(id, revokedAt) {
      await sql\`
        UPDATE auth_sessions
        SET revoked_at = \${revokedAt}
        WHERE id = \${id} AND revoked_at IS NULL
      \`;
    },

    async replaceRecoveryCodes(accountId, codes) {
      await sql.begin(async tx => {
        await tx\`DELETE FROM account_recovery_codes WHERE account_id = \${accountId}\`;
        for (const code of codes) {
          await tx\`
            INSERT INTO account_recovery_codes (account_id, code_hash, expires_at)
            VALUES (\${accountId}, \${code.codeHash}, \${code.expiresAt})
          \`;
        }
      });
    },

    async consumeRecoveryAndRevokeSessions(accountId, codeHash, now) {
      return sql.begin(async tx => {
        const [code] = await tx<{ id: string }[]>\`
          SELECT id
          FROM account_recovery_codes
          WHERE account_id = \${accountId}
            AND code_hash = \${codeHash}
            AND used_at IS NULL
            AND expires_at > \${now}
          FOR UPDATE
        \`;
        if (!code) return false;

        const consumed = await tx<{ id: string }[]>\`
          UPDATE account_recovery_codes
          SET used_at = \${now}
          WHERE id = \${code.id} AND used_at IS NULL
          RETURNING id
        \`;
        if (consumed.length !== 1) return false;

        await tx\`
          UPDATE accounts
          SET recovery_epoch = recovery_epoch + 1
          WHERE id = \${accountId} AND disabled_at IS NULL
        \`;
        await tx\`
          UPDATE auth_sessions
          SET revoked_at = \${now}
          WHERE account_id = \${accountId} AND revoked_at IS NULL
        \`;
        return true;
      });
    },

    async hasActiveMembership(accountId, organizationId) {
      const [row] = await sql<{ exists: boolean }[]>\`
        SELECT EXISTS (
          SELECT 1
          FROM organization_memberships
          WHERE account_id = \${accountId}
            AND organization_id = \${organizationId}
            AND status = 'active'
            AND suspended_at IS NULL
        ) AS exists
      \`;
      return row?.exists === true;
    },

    async listRoleGrants(accountId) {
      const rows = await sql<RoleGrantRow[]>\`
        SELECT id, account_id, role, version, organization_id, competition_id,
          granted_at, expires_at, revoked_at
        FROM role_grants
        WHERE account_id = \${accountId}
      \`;
      return rows.map(toRoleGrant);
    }
  };
}
