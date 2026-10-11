import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import { claimTenantDomain } from "@live-competition-engine/db/tenant-domains";
import { createDomainClaimPostHandler } from "./handler";

const postDomainClaim = createDomainClaimPostHandler(
  new AuthenticationService(createPostgresAuthStore()),
  claimTenantDomain
);

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await context.params;
  return postDomainClaim(request, organizationId);
}
