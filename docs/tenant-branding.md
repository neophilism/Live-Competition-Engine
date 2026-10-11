# Tenant branding boundary

LC-06 stores tenant-owned theme versions without allowing arbitrary CSS, scripts, remote assets or product-specific vocabulary into the reusable engine.

The supported contract is intentionally finite: four hex color tokens, one of three engine-owned typography stacks, one of three layout templates, an application-relative logo path and up to eight application-relative navigation items. Tenant assets and links cannot name an external origin. Downstream products may choose defaults and labels, but they consume the same validated contract.

Theme versions are scoped by `organization_id` and retained by revision. Exactly one version may be active for an organization. A caller must prove the same organization scope before parsing or persisting a tenant configuration; cross-tenant access fails closed.

Server rendering consumes `buildTenantThemeViewModel`, which validates untrusted theme input and returns an immutable structured model. It maps typography choices to engine-owned font stacks and exposes only fixed CSS custom-property names, relative assets and relative navigation. Renderers must bind this structure through framework APIs; they must not concatenate tenant values into raw HTML, stylesheets or scripts.

## Operator API

`POST /api/organizations/{organizationId}/theme` accepts the same finite theme contract. The endpoint requires an active opaque bearer session, active membership in the requested organization and an unexpired version-1 `tenant_operator` grant authorizing `tenant.manage`. Missing or invalid credentials return `401`; a role or tenant mismatch returns `403`; malformed themes return `400` without persistence.

Activation locks the organization row, allocates the next revision and replaces the active marker in one PostgreSQL transaction. Historical revisions remain immutable. The authenticated account is recorded as `updated_by_account_id`, and a deleted tenant returns `404` without creating an orphaned theme.

The validation, persistence, server-rendering and authenticated operator API boundaries are implemented. Asset upload remains follow-up work. This does not claim a custom domain, a deployed tenant site or production acceptance.
