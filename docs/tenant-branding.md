# Tenant branding boundary

LC-06 stores tenant-owned theme versions without allowing arbitrary CSS, scripts, remote assets or product-specific vocabulary into the reusable engine.

The supported contract is intentionally finite: four hex color tokens, one of three engine-owned typography stacks, one of three layout templates, an application-relative logo path and up to eight application-relative navigation items. Tenant assets and links cannot name an external origin. Downstream products may choose defaults and labels, but they consume the same validated contract.

Theme versions are scoped by `organization_id` and retained by revision. Exactly one version may be active for an organization. A caller must prove the same organization scope before parsing or persisting a tenant configuration; cross-tenant access fails closed.

Server rendering consumes `buildTenantThemeViewModel`, which validates untrusted theme input and returns an immutable structured model. It maps typography choices to engine-owned font stacks and exposes only fixed CSS custom-property names, relative assets and relative navigation. Renderers must bind this structure through framework APIs; they must not concatenate tenant values into raw HTML, stylesheets or scripts.

## Operator API

`POST /api/organizations/{organizationId}/theme` accepts the same finite theme contract. The endpoint requires an active opaque bearer session, active membership in the requested organization and an unexpired version-1 `tenant_operator` grant authorizing `tenant.manage`. Missing or invalid credentials return `401`; a role or tenant mismatch returns `403`; malformed themes return `400` without persistence.

Activation locks the organization row, allocates the next revision and replaces the active marker in one PostgreSQL transaction. Historical revisions remain immutable. The authenticated account is recorded as `updated_by_account_id`, and a deleted tenant returns `404` without creating an orphaned theme.

## Logo assets

`POST /api/organizations/{organizationId}/brand-assets/logo` uses the same `tenant.manage` authorization boundary before reading the request body. It accepts only PNG or WebP, streams at most 512 KiB, verifies the file signature instead of trusting `Content-Type`, computes SHA-256 and stores an immutable tenant-scoped asset. Identical bytes are deduplicated only within the same organization.

The returned `/api/tenant-assets/{assetId}` path is safe to place in a theme revision. Public reads expose only validated image bytes and return immutable cache, ETag and `nosniff` headers. SVG, HTML, remote URLs, filename-derived paths and general media uploads are deliberately excluded.

The LC-06 validation, persistence, server-rendering, authenticated operator API and bounded logo-upload boundaries are implemented. Custom domains, deployment and production acceptance remain separate work.
