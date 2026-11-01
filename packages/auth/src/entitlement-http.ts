import { AuthenticationError, type AuthenticationService } from "./index.ts";
import { entitlementCapabilities, type EntitlementService } from "./entitlements.ts";

const identifier = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const reply = (status: number, body: unknown) => Response.json(body, {
  status, headers: { "cache-control": "private, no-store", vary: "Authorization" }
});

/** Resolve only the current caller's access. A decision grants no role, payment,
 * consent or feature permission and must never be cached as an access token. */
export function createEntitlementGetHandler(
  authorizer: Pick<AuthenticationService, "authorize">,
  service: Pick<EntitlementService, "resolve">,
  eventBelongsToTenant: (organizationId: string, eventId: string) => Promise<boolean>
) {
  return async (request: Request, organizationId: string): Promise<Response> => {
    if (!identifier(organizationId)) return reply(400, { error: "invalid_entitlement_scope" });
    let principal;
    try {
      principal = await authorizer.authorize(request.headers.get("authorization"), organizationId);
    } catch (cause) {
      if (cause instanceof AuthenticationError) {
        return reply(cause.code === "forbidden" ? 403 : 401, { error: cause.code });
      }
      return reply(503, { error: "entitlement_unavailable" });
    }
    // Even injected adapters must return the tenant that was authenticated.
    if (principal.organizationId !== organizationId) return reply(403, { error: "forbidden" });
    const params = new URL(request.url).searchParams;
    const capability = params.get("capability");
    const eventId = params.get("eventId") ?? undefined;
    const unknownOrDuplicate = [...params.keys()].some(key =>
      !["capability", "eventId"].includes(key) || params.getAll(key).length !== 1);
    if (unknownOrDuplicate || !entitlementCapabilities.some(value => value === capability) ||
        (eventId !== undefined && !identifier(eventId)) ||
        ((capability === "event.view" || capability === "event.enter") && !eventId)) {
      return reply(400, { error: "invalid_entitlement_request" });
    }
    try {
      // A tenant-wide grant cannot prove that an arbitrary event belongs here.
      if (eventId && !(await eventBelongsToTenant(organizationId, eventId))) {
        return reply(404, { error: "event_not_found" });
      }
      const decision = await service.resolve(principal, {
        organizationId, ...(eventId ? { eventId } : {}),
        capability: capability as typeof entitlementCapabilities[number]
      });
      // Do not expose internal grant IDs, versions, account IDs or audit records.
      return reply(200, { allowed: decision.allowed, reason: decision.reason });
    } catch {
      // Storage, malformed records and audit failures all fail closed.
      return reply(503, { error: "entitlement_unavailable" });
    }
  };
}

