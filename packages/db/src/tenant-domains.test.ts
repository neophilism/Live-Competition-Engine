import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";
import { closeDatabaseConnection } from "./index.ts";
import {
  canonicalizeTenantDomain,
  claimTenantDomain,
  resolveTenantDomain,
  verifyTenantDomain
} from "./tenant-domains.ts";

test("canonicalizes public DNS names and rejects unsafe routing inputs", () => {
  assert.equal(canonicalizeTenantDomain("Events.Example.ORG."), "events.example.org");
  for (const invalid of ["localhost", "127.0.0.1", "*.customer.com", "customer.local", "-bad.customer.com"]) {
    assert.throws(() => canonicalizeTenantDomain(invalid), RangeError);
  }
});

test("binds a verified domain to exactly one tenant", async () => {
  const sql = postgres(parseServerEnv().DATABASE_URL, { max: 1 });
  const accountId = randomUUID();
  const otherAccountId = randomUUID();
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  const domain = `events-${randomUUID()}.customer.com`;

  try {
    await sql`
      INSERT INTO accounts (id, email) VALUES
        (${accountId}, ${`domain-${accountId}@example.test`}),
        (${otherAccountId}, ${`domain-${otherAccountId}@example.test`})
    `;
    await sql`
      INSERT INTO organizations (id, name, slug) VALUES
        (${organizationId}, 'Domain tenant', ${`domain-${organizationId}`}),
        (${otherOrganizationId}, 'Other tenant', ${`domain-${otherOrganizationId}`})
    `;

    const claim = await claimTenantDomain(organizationId, accountId, domain.toUpperCase());
    assert.ok(claim?.dnsChallenge);
    assert.equal(claim.domain, domain);
    assert.equal(await claimTenantDomain(otherOrganizationId, otherAccountId, domain), null);
    assert.equal(await resolveTenantDomain(domain), null);

    assert.deepEqual(
      await verifyTenantDomain(
        organizationId,
        claim.id,
        accountId,
        [["lce-domain-verification=wrong"]]
      ),
      { id: claim.id, domain, status: "proof_missing" }
    );
    assert.deepEqual(
      await verifyTenantDomain(
        organizationId,
        claim.id,
        accountId,
        [[claim.dnsChallenge.value.slice(0, 12), claim.dnsChallenge.value.slice(12)]]
      ),
      { id: claim.id, domain, status: "verified" }
    );
    assert.deepEqual(await resolveTenantDomain(domain.toUpperCase()), {
      organizationId,
      domain
    });
  } finally {
    await sql`DELETE FROM organization_domains WHERE domain = ${domain}`;
    await sql`DELETE FROM organizations WHERE id IN (${organizationId}, ${otherOrganizationId})`;
    await sql`DELETE FROM accounts WHERE id IN (${accountId}, ${otherAccountId})`;
    await sql.end();
    await closeDatabaseConnection();
  }
});
