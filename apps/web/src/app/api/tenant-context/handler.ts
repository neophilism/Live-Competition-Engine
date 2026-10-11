import type { TenantDomainContext } from "@live-competition-engine/db/tenant-domains";

export type ResolveTenantDomain = (domain: string) => Promise<TenantDomainContext | null>;

export function createTenantContextGetHandler(resolveTenantDomain: ResolveTenantDomain) {
  return async function getTenantContext(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol !== "https:") {
      return Response.json({ error: "tls_required" }, { status: 421 });
    }

    const context = await resolveTenantDomain(url.hostname);
    if (!context) return new Response(null, { status: 404 });
    return Response.json(context, {
      headers: {
        "cache-control": "private, no-store",
        vary: "Host"
      }
    });
  };
}
