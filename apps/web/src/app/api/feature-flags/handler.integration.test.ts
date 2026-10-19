import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { closeDatabaseConnection, getSqlClient } from "@live-competition-engine/db";
import { evaluateStoredFeature, setFeatureFlag } from "@live-competition-engine/db/feature-flags";
import { createFeatureHandlers } from "./handler";

const sql = getSqlClient();
afterAll(closeDatabaseConnection);

describe("feature flag API with PostgreSQL authorization and audit", () => {
  it("binds writes and reads to a verified tenant membership", async () => {
    const org = randomUUID(), other = randomUUID(), actor = randomUUID();
    const auth = new AuthenticationService(createPostgresAuthStore());
    const handlers = createFeatureHandlers(auth, setFeatureFlag, evaluateStoredFeature);
    try {
      await sql`INSERT INTO accounts (id, email) VALUES (${actor}, ${`flag-actor-${actor}@example.test`})`;
      await sql`INSERT INTO organizations (id, name, slug) VALUES
        (${org}, 'Flags A', ${`flags-a-${org}`}), (${other}, 'Flags B', ${`flags-b-${other}`})`;
      await sql`INSERT INTO organization_memberships (organization_id, account_id) VALUES (${org}, ${actor})`;
      await sql`INSERT INTO role_grants (id, account_id, role, version, organization_id, granted_by_account_id)
        VALUES (${randomUUID()}, ${actor}, 'tenant_operator', 1, ${org}, ${actor})`;
      const { token } = await auth.issueSession(actor);
      const write = (organizationId: string) => new Request("https://example.test/api/feature-flags", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ scope: "tenant", organizationId, feature: "ticketing",
          enabled: true, expectedRevision: 0, actorAccountId: randomUUID() })
      });
      expect((await handlers.post(write(other))).status).toBe(403);
      const result = await handlers.post(write(org));
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ revision: 1 });
      const stored = await sql<{ updated_by_account_id: string }[]>`
        SELECT updated_by_account_id FROM feature_flags
        WHERE scope_key = ${`tenant:${org}`} AND feature = 'ticketing'
      `;
      expect(stored[0]?.updated_by_account_id).toBe(actor);
      const read = (organizationId: string) => new Request(
        `https://example.test/api/feature-flags?organizationId=${organizationId}&feature=ticketing&accountId=${randomUUID()}`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      expect((await handlers.get(read(other))).status).toBe(403);
      const decisionResponse = await handlers.get(read(org));
      expect(decisionResponse.status).toBe(200);
      const decision = await decisionResponse.json();
      expect(decision.context.accountId).toBe(actor);
      expect(decision.enabled).toBe(false); // platform remains disabled
      const audit = await sql<{ account_id: string }[]>`
        SELECT account_id FROM feature_decision_audit
        WHERE organization_id = ${org} AND feature = 'ticketing'
      `;
      expect(audit).toHaveLength(1);
      expect(audit[0]?.account_id).toBe(actor);
    } finally {
      await sql`DELETE FROM feature_decision_audit WHERE organization_id IN (${org}, ${other})`;
      await sql`DELETE FROM feature_flags WHERE organization_id IN (${org}, ${other})`;
      await sql`DELETE FROM role_grants WHERE account_id = ${actor}`;
      await sql`DELETE FROM auth_sessions WHERE account_id = ${actor}`;
      await sql`DELETE FROM organization_memberships WHERE account_id = ${actor}`;
      await sql`DELETE FROM organizations WHERE id IN (${org}, ${other})`;
      await sql`DELETE FROM accounts WHERE id = ${actor}`;
    }
  });
});
