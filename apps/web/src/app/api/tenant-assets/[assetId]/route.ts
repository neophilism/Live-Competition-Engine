import { getTenantBrandAsset } from "@live-competition-engine/db/tenant-brand-assets";
import { createBrandAssetGetHandler } from "./handler";

const getBrandAsset = createBrandAssetGetHandler(getTenantBrandAsset);

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await context.params;
  return getBrandAsset(assetId);
}
