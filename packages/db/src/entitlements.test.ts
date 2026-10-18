import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EntitlementService } from "@live-competition-engine/auth/entitlements";
import { PostgresEntitlementStore } from "./entitlements.ts";
import { getSqlClient, closeDatabaseConnection } from "./index.ts";

test("entitlement storage preserves scope constraints, refund status and decision audit", async () => {
  const sql = getSqlClient();
  const org = randomUUID(), other = randomUUID(), account = randomUUID(), event = randomUUID(), grant = randomUUID();
  try {
    await sql`INSERT INTO organizations(id, name, slug) VALUES (${org}, 'Entitlement tenant', ${org}), (${other}, 'Other tenant', ${other})`;
    await sql`INSERT INTO accounts(id) VALUES (${account})`;
    await sql`INSERT INTO organization_memberships(organization_id, account_id) VALUES (${org}, ${account})`;
    await sql`INSERT INTO competitions(id, organization_id, title) VALUES (${event}, ${org}, 'Fixture')`;
    await assert.rejects(sql`INSERT INTO entitlement_grants(organization_id, account_id, event_id, capability, source, status, starts_at)
      VALUES (${other}, ${account}, ${event}, 'event.view', 'ticket', 'active', 100)`, /foreign key/);
    await assert.rejects(sql`INSERT INTO entitlement_grants(organization_id, account_id, event_id, capability, source, status, starts_at)
      VALUES (${org}, ${account}, ${event}, 'staff.operate', 'ticket', 'active', 100)`, /check constraint/);
    await sql`INSERT INTO entitlement_grants(id, organization_id, account_id, event_id, capability, source, status, starts_at, expires_at)
      VALUES (${grant}, ${org}, ${account}, ${event}, 'event.view', 'ticket', 'active', 100, 200)`;
    const adapter = new PostgresEntitlementStore();
    const service = new EntitlementService(adapter, adapter);
    const principal = { organizationId: org, accountId: account, sessionId: randomUUID() };
    const request = { organizationId: org, eventId: event, capability: "event.view" as const };
    assert.equal((await service.require(principal, request, 150)).grantId, grant);
    await sql`UPDATE entitlement_grants SET status = 'refunded' WHERE id = ${grant}`;
    assert.equal((await service.resolve(principal, request, 150)).allowed, false);
    assert.equal((await adapter.listGrants(other, account)).length, 0);
    const rows = await sql`SELECT allowed FROM entitlement_decisions WHERE organization_id = ${org} AND account_id = ${account}`;
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => row.allowed === true).length, 1);
  } finally {
    await sql`DELETE FROM entitlement_decisions WHERE organization_id = ${org}`;
    await sql`DELETE FROM entitlement_grants WHERE organization_id IN (${org}, ${other})`;
    await sql`DELETE FROM competitions WHERE id = ${event}`;
    await sql`DELETE FROM organization_memberships WHERE account_id = ${account}`;
    await sql`DELETE FROM accounts WHERE id = ${account}`;
    await sql`DELETE FROM organizations WHERE id IN (${org}, ${other})`;
    await closeDatabaseConnection();
  }
});
