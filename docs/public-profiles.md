# Public profiles  LC-10 implementation checkpoint

The profiles package supplies the server-side privacy projection for neutral
performer, producer and judge profiles. It accepts a tenant selected by trusted
routing and an optional viewer obtained from fresh active membership checks.
Public profiles allow anonymous reads; members profiles require tenant
membership; private profiles allow only their owner. Cross-tenant reads return
no record.

Only allowlisted presentation fields leave the projection. Owner account and
tenant identifiers are excluded; unpublished history is excluded even for the
owner. All output collections are copied and frozen. Render strings as text,
never raw HTML. Do not globally cache private/member projections or reuse a
viewer from client-supplied data.

This PR is deliberately draft. Remaining LC-10 acceptance work:
- Persist profiles and publication state with tenant/account constraints.
- Authorize owner/operator edits and record revisions/audit.
- Link history to actual authorized, published competition results.
- Wire authenticated/public HTTP read paths and accessible profile pages.
- Add database and HTTP integration tests; verify migration/typecheck/build CI.

The pure projection is independently implementable on existing merged identity
and tenancy foundations. It does not require pending feature-flag/entitlement
PRs and does not mark the broader LC-10 milestone complete.
