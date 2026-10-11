import { resolveTxt } from "node:dns/promises";
import { AuthenticationService } from "@live-competition-engine/auth";
import { createPostgresAuthStore } from "@live-competition-engine/db/auth-store";
import {
  getTenantDomainChallenge,
  verifyTenantDomain
} from "@live-competition-engine/db/tenant-domains";
import { createDomainVerifyPostHandler } from "../../handler";

const postDomainVerification = createDomainVerifyPostHandler(
  new AuthenticationService(createPostgresAuthStore()),
  getTenantDomainChallenge,
  resolveTxt,
  verifyTenantDomain
);

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; domainId: string }> }
) {
  const { organizationId, domainId } = await context.params;
  return postDomainVerification(request, organizationId, domainId);
}
