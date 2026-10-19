# Hierarchical feature flags (LC-08)

Import the server-side contract from `@live-competition-engine/config/features`.
The platform must explicitly enable a feature. Tenant, event and account settings
inherit when absent; any explicit false vetoes the feature. A child true cannot
override an ancestor false. Unknown features, malformed values and mismatched
tenant/event/account records are rejected.

Call `requireFeature` before an enabled operation and use `evaluateFeature` to
derive presentation. Both require an audit adapter whose `record` promise resolves
only after durable recording. Failed recording prevents a decision from being
returned. Decisions include authenticated scope identifiers, policy revisions,
all evaluated values, the controlling scope and reason, without credentials.

The caller must load policy records from trusted server storage, bind event and
account scope to authenticated authorization, and supply the authorized
organization. Never construct context or policy from client claims. A flag
does not grant a role, entitlement or legal consent. Platform defaults are off;
absence of a narrower record means inheritance, so callers must not drop an
existing restrictive record on a read failure. Propagate storage failures.

Supported independent monetization switches cover tickets, entry fees, PPV,
subscriptions, creator memberships, tips/gifts, sponsorship, advertising,
merchandise, booking and SaaS. Custom domains, analytics, storage, chat and voting
also have independent switches. Future controllers (LC-43/44) must authorize
policy mutations and persist revisioned records before evaluation. Future
commerce and interaction units must apply the guard before side effects and
hide disabled purchase/interaction paths. No commerce endpoints exist in this
unit; this library does not claim those future integrations are implemented.

Validation: exhaustive 81 platform/tenant/event/account true/false/inherit cases,
cross-tenant/event/account rejection, immutable audit evidence, malformed input,
default-off behavior and audit-outage propagation.

## Durable policy and audit storage

`@live-competition-engine/db/feature-flags` stores revisioned platform, tenant,
event and account settings. `setFeatureFlag` compares the expected revision and
rejects a stale write. The caller must authorize the corresponding management
action before invoking it. `evaluateStoredFeature` verifies event ownership and
active account membership, reads the relevant settings, then records the complete
decision inside the same database transaction before returning. An absent platform
setting is disabled; a child cannot override an ancestor veto. Storage outages
fail closed. The migration adds `feature_flags` and `feature_decision_audit`.

A future HTTP management controller must bind actor identity and scope to a
verified session. Do not expose these storage functions directly to clients.
