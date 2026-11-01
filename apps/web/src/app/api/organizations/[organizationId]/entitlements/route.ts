import { AuthenticationService } from "@live-competition-engine/auth";
import { EntitlementService } from "@live-competition-engine/auth/entitlements";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { PostgresEntitlementStore, entitlementEventBelongsToTenant } from "@live-competition-engine/db/entitlements";
import { createEntitlementGetHandler } from "@live-competition-engine/auth/entitlement-http";

export const dynamic = "force-dynamic";
const store = new PostgresEntitlementStore();
const getEntitlement = createEntitlementGetHandler(
  new AuthenticationService(createPostgresAuthStore()),
  new EntitlementService(store, store),
  entitlementEventBelongsToTenant
);

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params;
  return getEntitlement(request, organizationId);
}

