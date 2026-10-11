import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  AuthenticationError,
  AuthenticationService
} from "@live-competition-engine/auth";
import { parseServerEnv } from "@live-competition-engine/config";
import type { TenantTheme } from "@live-competition-engine/config/theme";
import { createPostgresAuthStore } from "./auth-store.ts";
import { closeDatabaseConnection } from "./index.ts";
import { activateTenantTheme } from "./tenant-theme.ts";

const theme: TenantTheme = {
  logoPath: "/tenant-assets/logo.svg",
  colors: {
    primary: "#102A43",
    surface: "#F5F7FA",
    text: "#101820",
    accent: "#D64545"
  },
  typography: "humanist",
  template: "editorial",
  navigation: [{ label: "Schedule", path: "/schedule" }]
};

test("authorizes and transactionally versions tenant theme updates", async () => {
  const sql = postgres(parseServerEnv().DATABASE_URL, { max: 1 });
  const accountId = randomUUID();
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  const grantId = randomUUID();

  try {
    await sql`
      INSERT INTO accounts (id, email)
      VALUES (${accountId}, ${`operator-${accountId}@example.test`})
    `;
    await sql`
      INSERT INTO organizations (id, name, slug)
      VALUES
        (${organizationId}, 'Tenant A', ${`tenant-a-${organizationId}`}),
        (${otherOrganizationId}, 'Tenant B', ${`tenant-b-${otherOrganizationId}`})
    `;
    await sql`
      INSERT INTO organization_memberships (organization_id, account_id)
      VALUES (${organizationId}, ${accountId})
    `;
    await sql`
      INSERT INTO role_grants (
        id, account_id, role, version, organization_id, granted_by_account_id
      ) VALUES (
        ${grantId}, ${accountId}, 'tenant_operator', 1, ${organizationId}, ${accountId}
      )
    `;

    const auth = new AuthenticationService(createPostgresAuthStore());
    const { token } = await auth.issueSession(accountId);
    const principal = await auth.authorizeAction(
      `Bearer ${token}`,
      "tenant.manage",
      { organizationId }
    );
    assert.equal(principal.role, "tenant_operator");

    await assert.rejects(
      auth.authorizeAction(
        `Bearer ${token}`,
        "tenant.manage",
        { organizationId: otherOrganizationId }
      ),
      (error: unknown) =>
        error instanceof AuthenticationError && error.code === "forbidden"
    );

    assert.deepEqual(
      await activateTenantTheme(organizationId, accountId, theme),
      { organizationId, revision: 1 }
    );
    assert.deepEqual(
      await activateTenantTheme(organizationId, accountId, {
        ...theme,
        template: "compact"
      }),
      { organizationId, revision: 2 }
    );

    const rows = await sql<{ revision: number; is_active: boolean; template: string }[]>`
      SELECT revision, is_active, template
      FROM organization_theme_versions
      WHERE organization_id = ${organizationId}
      ORDER BY revision
    `;
    assert.deepEqual([...rows], [
      { revision: 1, is_active: false, template: "editorial" },
      { revision: 2, is_active: true, template: "compact" }
    ]);
  } finally {
    await sql`DELETE FROM organization_theme_versions WHERE organization_id = ${organizationId}`;
    await sql`DELETE FROM role_grants WHERE account_id = ${accountId}`;
    await sql`DELETE FROM auth_sessions WHERE account_id = ${accountId}`;
    await sql`DELETE FROM organization_memberships WHERE account_id = ${accountId}`;
    await sql`DELETE FROM organizations WHERE id IN (${organizationId}, ${otherOrganizationId})`;
    await sql`DELETE FROM accounts WHERE id = ${accountId}`;
    await sql.end();
    await closeDatabaseConnection();
  }
});
