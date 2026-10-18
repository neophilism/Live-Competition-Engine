# Entitlements (LC-09)

The server-only EntitlementService resolves current purchased and granted access
for tickets, subscriptions, staff and manual grants. Import it from
`@live-competition-engine/auth/entitlements`; use PostgresEntitlementStore from
`@live-competition-engine/db/entitlements` as both storage and audit adapter.

Supply a freshly authenticated tenant Principal and an authorized event request.
The event identifier currently references the engine's competitions table.
The service checks tenant/account scope, exact capabilities, event scope,
inclusive start/exclusive expiry, status and record version. Pending, refunded,
revoked, expired or future grants do not authorize access. Unknown records and
storage/audit failures throw. All decisions are recorded before returning.

Each resolution reads storage again; do not cache decisions across requests.
A subscription or manual grant with null event scope covers its tenant.
Tickets require an event. Only staff-sourced grants may carry staff.operate.
Staff entitlement alone does not grant an operator role: authorizeAction remains
a separate mandatory check for privileged operations. Feature enablement and
legal/consent checks also remain separate.

Migration 0008 adds tenant-bound grant relationships and decision history.
Grant creation/refund/revocation must run through the future authorized commerce
and staff workflows; no client grant-writing endpoint is exposed. Persist a
provider-confirmed refund/revocation before subsequent access resolution.
An already returned decision is a snapshot, not a transactional lock: for
monetary or irreversible actions, revalidate within the action transaction.
Provider integration, policy administration and payments are separately planned
units, not claimed implemented here.

Tests cover active boundaries, all statuses, cross-account/tenant/event denial,
malformed records, staff separation, fresh refund reads and audit/storage
failures. Database integration checks exercise real constraints and adapter
round-trips when CI supplies PostgreSQL.
