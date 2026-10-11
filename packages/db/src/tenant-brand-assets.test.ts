import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { parseServerEnv } from "@live-competition-engine/config";
import { closeDatabaseConnection } from "./index.ts";
import {
  getTenantBrandAsset,
  storeTenantLogoAsset
} from "./tenant-brand-assets.ts";

test("stores tenant logo bytes immutably and deduplicates within a tenant", async () => {
  const sql = postgres(parseServerEnv().DATABASE_URL, { max: 1 });
  const accountId = randomUUID();
  const organizationId = randomUUID();
  const content = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const sha256 = createHash("sha256").update(content).digest("hex");

  try {
    await sql`INSERT INTO accounts (id, email) VALUES (${accountId}, ${`brand-${accountId}@example.test`})`;
    await sql`
      INSERT INTO organizations (id, name, slug)
      VALUES (${organizationId}, 'Brand tenant', ${`brand-${organizationId}`})
    `;

    const first = await storeTenantLogoAsset(organizationId, accountId, {
      contentType: "image/png",
      sha256,
      content
    });
    const second = await storeTenantLogoAsset(organizationId, accountId, {
      contentType: "image/png",
      sha256,
      content
    });

    assert.ok(first);
    assert.deepEqual(second, first);
    assert.deepEqual(await getTenantBrandAsset(first.id), {
      contentType: "image/png",
      sha256,
      content
    });

    const [count] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM organization_brand_assets
      WHERE organization_id = ${organizationId}
    `;
    assert.equal(count?.count, 1);
  } finally {
    await closeDatabaseConnection();
    await sql`DELETE FROM organization_brand_assets WHERE organization_id = ${organizationId}`;
    await sql`DELETE FROM organizations WHERE id = ${organizationId}`;
    await sql`DELETE FROM accounts WHERE id = ${accountId}`;
    await sql.end();
  }
});
