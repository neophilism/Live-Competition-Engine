import type { TenantBrandAsset } from "@live-competition-engine/db/tenant-brand-assets";

export type FetchBrandAsset = (assetId: string) => Promise<TenantBrandAsset | null>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createBrandAssetGetHandler(fetchAsset: FetchBrandAsset) {
  return async function getBrandAsset(assetId: string): Promise<Response> {
    if (!uuid.test(assetId)) return new Response(null, { status: 404 });
    const asset = await fetchAsset(assetId);
    if (!asset) return new Response(null, { status: 404 });

    return new Response(asset.content, {
      status: 200,
      headers: {
        "content-type": asset.contentType,
        "content-length": String(asset.content.byteLength),
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${asset.sha256}"`,
        "x-content-type-options": "nosniff"
      }
    });
  };
}
