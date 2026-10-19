import { AuthenticationError, type AuthenticationService } from "@live-competition-engine/auth";
import { featureKeySchema, type FeatureDecision, type FeatureKey } from "@live-competition-engine/config/features";
import type { FeatureFlagUpdate } from "@live-competition-engine/db/feature-flags";

type Authorizer = Pick<AuthenticationService, "authorize" | "authorizeAction">;
type Save = (update: FeatureFlagUpdate) => Promise<number>;
type Evaluate = (feature: FeatureKey, context: { organizationId: string; eventId?: string; accountId?: string }) => Promise<FeatureDecision>;

const error = (status: number, code: string) => Response.json({ error: code }, { status });
const authError = (cause: unknown): Response | null => cause instanceof AuthenticationError
  ? error(cause.code === "forbidden" ? 403 : 401, cause.code) : null;

export function createFeatureHandlers(authorizer: Authorizer, save: Save, evaluate: Evaluate) {
  return {
    async post(request: Request): Promise<Response> {
      let body: unknown;
      try { body = await request.json(); } catch { return error(400, "invalid_json"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "invalid_feature_policy");
      const input = body as Record<string, unknown>;
      if (!["platform", "tenant", "event", "account"].includes(String(input.scope)) ||
          !featureKeySchema.safeParse(input.feature).success || typeof input.enabled !== "boolean" ||
          typeof input.expectedRevision !== "number" || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
          (input.scope !== "platform" && typeof input.organizationId !== "string") ||
          (input.scope === "event" && typeof input.eventId !== "string") ||
          (input.scope === "account" && typeof input.accountId !== "string")) return error(400, "invalid_feature_policy");
      const scope = input.scope as FeatureFlagUpdate["scope"];
      const organizationId = input.organizationId as string | undefined;
      const eventId = input.eventId as string | undefined;
      const accountId = input.accountId as string | undefined;
      let principal;
      try {
        principal = await authorizer.authorizeAction(
          request.headers.get("authorization"),
          scope === "platform" ? "platform.manage" : scope === "event" ? "event.manage" : "tenant.manage",
          scope === "platform" ? {} : {
            organizationId,
            ...(scope === "event" ? { competitionId: eventId } : {})
          }
        );
      } catch (cause) { const response = authError(cause); if (response) return response; throw cause; }
      try {
        const revision = await save({
          scope, organizationId, eventId, accountId,
          feature: input.feature as FeatureKey, enabled: input.enabled as boolean,
          expectedRevision: input.expectedRevision as number, actorAccountId: principal.accountId
        });
        return Response.json({ revision });
      } catch (cause) {
        if (cause instanceof Error && /revision conflict/.test(cause.message)) return error(409, "revision_conflict");
        if (cause instanceof Error && /Invalid |Unexpected |scope denied/.test(cause.message)) return error(400, "invalid_feature_scope");
        throw cause;
      }
    },
    async get(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const organizationId = url.searchParams.get("organizationId");
      const eventId = url.searchParams.get("eventId") ?? undefined;
      const feature = featureKeySchema.safeParse(url.searchParams.get("feature"));
      if (!organizationId || !feature.success) return error(400, "invalid_feature_context");
      let principal;
      try {
        principal = await authorizer.authorize(request.headers.get("authorization"), organizationId);
      } catch (cause) { const response = authError(cause); if (response) return response; throw cause; }
      try {
        const decision = await evaluate(feature.data, { organizationId, eventId, accountId: principal.accountId });
        return Response.json(decision);
      } catch (cause) {
        if (cause instanceof Error && /Invalid |scope denied/.test(cause.message)) return error(400, "invalid_feature_context");
        throw cause;
      }
    }
  };
}
