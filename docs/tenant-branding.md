# Tenant branding boundary

LC-06 stores tenant-owned theme versions without allowing arbitrary CSS, scripts, remote assets or product-specific vocabulary into the reusable engine.

The supported contract is intentionally finite: four hex color tokens, one of three engine-owned typography stacks, one of three layout templates, an application-relative logo path and up to eight application-relative navigation items. Tenant assets and links cannot name an external origin. Downstream products may choose defaults and labels, but they consume the same validated contract.

Theme versions are scoped by `organization_id` and retained by revision. Exactly one version may be active for an organization. A caller must prove the same organization scope before parsing or persisting a tenant configuration; cross-tenant access fails closed.

Server rendering consumes `buildTenantThemeViewModel`, which validates untrusted theme input and returns an immutable structured model. It maps typography choices to engine-owned font stacks and exposes only fixed CSS custom-property names, relative assets and relative navigation. Renderers must bind this structure through framework APIs; they must not concatenate tenant values into raw HTML, stylesheets or scripts.

The validation, persistence and server-rendering boundaries are implemented. An authenticated operator API and asset-upload workflow remain follow-up work. This does not claim a custom domain, a deployed tenant site or production acceptance.
