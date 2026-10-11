import { randomUUID } from "node:crypto";
import { getSqlClient } from "./index.ts";

export interface TenantBrandAssetInput {
  contentType: "image/png" | "image/webp";
  sha256: string;
  content: Uint8Array;
}

export interface StoredTenantBrandAsset {
  id: string;
  path: string;
  sha256: string;
}

export interface TenantBrandAsset {
  contentType: "image/png" | "image/webp";
  sha256: string;
  content: Uint8Array;
}

export async function storeTenantLogoAsset(
  organizationId: string,
  accountId: string,
  asset: TenantBrandAssetInput
): Promise<StoredTenantBrandAsset | null> {
  const sql = getSqlClient();

  return sql.begin(async tx => {
    const organizations = await tx<{ id: string }[]>`
      SELECT id FROM organizations WHERE id = ${organizationId} FOR SHARE
    `;
    if (organizations.length !== 1) return null;

    const id = randomUUID();
    const [row] = await tx<{ id: string }[]>`
      WITH inserted AS (
        INSERT INTO organization_brand_assets (
          id, organization_id, kind, content_type, byte_length,
          sha256, content, uploaded_by_account_id
        ) VALUES (
          ${id}, ${organizationId}, 'logo', ${asset.contentType}, ${asset.content.byteLength},
          ${asset.sha256}, ${asset.content}, ${accountId}
        )
        ON CONFLICT (organization_id, kind, sha256) DO NOTHING
        RETURNING id
      )
      SELECT id FROM inserted
      UNION ALL
      SELECT id FROM organization_brand_assets
      WHERE organization_id = ${organizationId}
        AND kind = 'logo'
        AND sha256 = ${asset.sha256}
      LIMIT 1
    `;
    if (!row) throw new Error("Brand asset persistence did not return an identifier.");

    return {
      id: row.id,
      path: `/api/tenant-assets/${row.id}`,
      sha256: asset.sha256
    };
  });
}

export async function getTenantBrandAsset(assetId: string): Promise<TenantBrandAsset | null> {
  const sql = getSqlClient();
  const [row] = await sql<{
    content_type: "image/png" | "image/webp";
    sha256: string;
    content: Uint8Array;
  }[]>`
    SELECT content_type, sha256, content
    FROM organization_brand_assets
    WHERE id = ${assetId}
  `;

  return row ? {
    contentType: row.content_type,
    sha256: row.sha256,
    content: new Uint8Array(row.content)
  } : null;
}
