import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { storeTenantLogoAsset } from "@live-competition-engine/db/tenant-brand-assets";
import { createBrandLogoPostHandler } from "./handler";

const postBrandLogo = createBrandLogoPostHandler(
  new AuthenticationService(createPostgresAuthStore()),
  storeTenantLogoAsset
);

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await context.params;
  return postBrandLogo(request, organizationId);
}
