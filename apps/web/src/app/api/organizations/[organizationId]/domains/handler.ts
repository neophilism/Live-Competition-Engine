import {
  AuthenticationError,
  type AuthenticationService
} from "@live-competition-engine/auth";
import type {
  DomainClaim,
  DomainVerification
} from "@live-competition-engine/db/tenant-domains";

type DomainAuthorizer = Pick<AuthenticationService, "authorizeAction">;

export type ClaimDomain = (
  organizationId: string,
  accountId: string,
  domain: string
) => Promise<DomainClaim | null>;

export type ReadChallenge = (
  organizationId: string,
  domainId: string
) => Promise<{ domain: string; tokenHash: string; createdAt: Date } | null>;

export type VerifyDomain = (
  organizationId: string,
  domainId: string,
  accountId: string,
  records: readonly (readonly string[])[]
) => Promise<DomainVerification | null>;

export type ResolveTxt = (hostname: string) => Promise<string[][]>;

const errorResponse = (status: number, code: string) =>
  Response.json({ error: code }, { status });

const authorize = async (
  authorizer: DomainAuthorizer,
  request: Request,
  organizationId: string
) => {
  try {
    return await authorizer.authorizeAction(
      request.headers.get("authorization"),
      "tenant.manage",
      { organizationId }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) return errorResponse(error.code === "forbidden" ? 403 : 401, error.code);
    throw error;
  }
};

export function createDomainClaimPostHandler(
  authorizer: DomainAuthorizer,
  claimDomain: ClaimDomain
) {
  return async function postDomainClaim(request: Request, organizationId: string): Promise<Response> {
    const principal = await authorize(authorizer, request, organizationId);
    if (principal instanceof Response) return principal;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "invalid_json");
    }
    if (!body || typeof body !== "object" || typeof (body as { domain?: unknown }).domain !== "string") {
      return errorResponse(400, "invalid_domain");
    }

    let result: DomainClaim | null;
    try {
      result = await claimDomain(
        organizationId,
        principal.accountId,
        (body as { domain: string }).domain
      );
    } catch (error) {
      if (error instanceof RangeError) return errorResponse(400, "invalid_domain");
      throw error;
    }
    if (!result) return errorResponse(409, "domain_unavailable");
    return Response.json(result, { status: result.status === "verified" ? 200 : 201 });
  };
}

export function createDomainVerifyPostHandler(
  authorizer: DomainAuthorizer,
  readChallenge: ReadChallenge,
  resolveTxt: ResolveTxt,
  verifyDomain: VerifyDomain
) {
  return async function postDomainVerification(
    request: Request,
    organizationId: string,
    domainId: string
  ): Promise<Response> {
    const principal = await authorize(authorizer, request, organizationId);
    if (principal instanceof Response) return principal;
    const challenge = await readChallenge(organizationId, domainId);
    if (!challenge) return errorResponse(404, "domain_challenge_not_found");

    let records: string[][];
    try {
      records = await resolveTxt(`_lce-domain.${challenge.domain}`);
    } catch {
      return errorResponse(503, "dns_lookup_failed");
    }
    const result = await verifyDomain(
      organizationId,
      domainId,
      principal.accountId,
      records
    );
    if (!result) return errorResponse(404, "domain_challenge_not_found");
    if (result.status === "proof_missing") return errorResponse(409, "domain_proof_missing");
    if (result.status === "challenge_expired") return errorResponse(409, "domain_challenge_expired");
    return Response.json(result);
  };
}
