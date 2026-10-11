# Custom domains

LC-07 begins with a fail-closed custom-domain control plane. A tenant operator submits a public DNS name to `POST /api/organizations/{organizationId}/domains`. The engine canonicalizes IDNs to ASCII, rejects IP addresses, wildcards, single-label and reserved names, and assigns the normalized name globally to at most one organization.

The response returns a one-time TXT challenge at `_lce-domain.<domain>`. `POST /api/organizations/{organizationId}/domains/{domainId}/verify` resolves that exact DNS name and activates the association only when the fragmented TXT value hashes to the stored challenge. Challenges expire after 24 hours and can be rotated by submitting the same pending domain again. Authorization occurs before claim or DNS lookup, and cross-tenant claims fail closed.

`GET /api/tenant-context` derives the tenant only from the HTTPS request URL hostname, ignores forwarded-host hints, and returns no context for pending, disabled, malformed or unknown domains. Application code must use this verified association rather than accepting an organization identifier from a host header or query parameter.

This repository does not provision DNS or certificates. Production ingress must terminate TLS, preserve the validated request URL host, route only configured domains to the service, and complete certificate issuance and renewal checks before a domain is advertised. The portable code and tests do not constitute live DNS, TLS, routing or deployment evidence, so LC-07 remains partial until those operational checks exist.
