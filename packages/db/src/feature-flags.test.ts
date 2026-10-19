import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";
import { closeDatabaseConnection } from "./index.ts";
import { evaluateStoredFeature, setFeatureFlag } from "./feature-flags.ts";

test("durable feature policy uses scoped vetoes, revisions and audited decisions", async () => {
  const sql = postgres(parseServerEnv().DATABASE_URL, { max: 1 });
  const org = randomUUID(), other = randomUUID(), event = randomUUID();
  const actor = randomUUID(), member = randomUUID();
  try {
    await sql`INSERT INTO accounts (id, email) VALUES (${actor}, ${`actor-${actor}@example.test`}), (${member}, ${`member-${member}@example.test`})`;
    await sql`INSERT INTO organizations (id, name, slug) VALUES (${org}, 'Feature A', ${`feature-a-${org}`}), (${other}, 'Feature B', ${`feature-b-${other}`})`;
    await sql`INSERT INTO organization_memberships (organization_id, account_id) VALUES (${org}, ${member})`;
    await sql`INSERT INTO competitions (id, organization_id, title) VALUES (${event}, ${org}, 'Feature test')`;

    assert.equal((await evaluateStoredFeature("advertising", { organizationId: org })).enabled, false);
    assert.equal(await setFeatureFlag({ scope: "platform", feature: "advertising", enabled: true, expectedRevision: 0, actorAccountId: actor }), 1);
    assert.equal((await evaluateStoredFeature("advertising", { organizationId: org })).enabled, true);
    assert.equal(await setFeatureFlag({ scope: "tenant", organizationId: org, feature: "advertising", enabled: false, expectedRevision: 0, actorAccountId: actor }), 1);
    assert.equal((await evaluateStoredFeature("advertising", { organizationId: org, eventId: event, accountId: member })).enabled, false);
    assert.equal(await setFeatureFlag({ scope: "event", organizationId: org, eventId: event, feature: "advertising", enabled: true, expectedRevision: 0, actorAccountId: actor }), 1);
    assert.equal((await evaluateStoredFeature("advertising", { organizationId: org, eventId: event })).enabled, false);
    assert.equal(await setFeatureFlag({ scope: "tenant", organizationId: org, feature: "advertising", enabled: true, expectedRevision: 1, actorAccountId: actor }), 2);
    assert.equal((await evaluateStoredFeature("advertising", { organizationId: org, eventId: event })).enabled, true);
    await assert.rejects(setFeatureFlag({ scope: "tenant", organizationId: org, feature: "advertising", enabled: false, expectedRevision: 1, actorAccountId: actor }), /revision conflict/);
    await assert.rejects(setFeatureFlag({ scope: "event", organizationId: other, eventId: event, feature: "advertising", enabled: true, expectedRevision: 0, actorAccountId: actor }), /scope denied/);
    await assert.rejects(evaluateStoredFeature("advertising", { organizationId: other, eventId: event }), /scope denied/);
    await assert.rejects(evaluateStoredFeature("advertising", { organizationId: other, accountId: member }), /scope denied/);
    const audit = await sql<{ enabled: boolean; reason: string }[]>`
      SELECT enabled, reason FROM feature_decision_audit
      WHERE organization_id = ${org} AND feature = 'advertising'
      ORDER BY id
    `;
    assert.deepEqual(audit.map(row => row.enabled), [false, true, false, false, true]);
    assert.equal(audit[0]?.reason, "not_enabled_at_platform");
  } finally {
    await sql`DELETE FROM feature_decision_audit WHERE organization_id IN (${org}, ${other})`;
    await sql`DELETE FROM feature_flags WHERE feature = 'advertising' AND (scope_key = 'platform' OR organization_id IN (${org}, ${other}))`;
    await sql`DELETE FROM competitions WHERE id = ${event}`;
    await sql`DELETE FROM organization_memberships WHERE organization_id = ${org}`;
    await sql`DELETE FROM organizations WHERE id IN (${org}, ${other})`;
    await sql`DELETE FROM accounts WHERE id IN (${actor}, ${member})`;
    await sql.end();
    await closeDatabaseConnection();
  }
});
