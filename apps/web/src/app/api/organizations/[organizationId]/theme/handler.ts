import {
  AuthenticationError,
  type AuthenticationService
} from "@live-competition-engine/auth";
import {
  tenantThemeSchema,
  type TenantTheme
} from "@live-competition-engine/config/theme";

type TenantThemeAuthorizer = Pick<AuthenticationService, "authorizeAction">;

export type PersistTenantTheme = (
  organizationId: string,
  accountId: string,
  theme: TenantTheme
) => Promise<{ organizationId: string; revision: number } | null>;

const errorResponse = (status: number, code: string) =>
  Response.json({ error: code }, { status });

export function createTenantThemePostHandler(
  authorizer: TenantThemeAuthorizer,
  persistTheme: PersistTenantTheme
) {
  return async function postTenantTheme(
    request: Request,
    organizationId: string
  ): Promise<Response> {
    let principal;
    try {
      principal = await authorizer.authorizeAction(
        request.headers.get("authorization"),
        "tenant.manage",
        { organizationId }
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(error.code === "forbidden" ? 403 : 401, error.code);
      }
      throw error;
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return errorResponse(400, "invalid_json");
    }

    const parsed = tenantThemeSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_theme", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const activated = await persistTheme(
      organizationId,
      principal.accountId,
      parsed.data
    );
    if (!activated) return errorResponse(404, "organization_not_found");

    return Response.json(activated, { status: 201 });
  };
}
