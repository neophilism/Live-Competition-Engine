import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { activateTenantTheme } from "@live-competition-engine/db/tenant-theme";
import { createTenantThemePostHandler } from "./handler";

const postTenantTheme = createTenantThemePostHandler(
  new AuthenticationService(createPostgresAuthStore()),
  activateTenantTheme
);

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await context.params;
  return postTenantTheme(request, organizationId);
}
