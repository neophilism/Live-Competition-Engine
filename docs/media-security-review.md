# LC-11 security and acceptance review

This is AI-assisted source review, not an independent human audit or certification.
The work remains in draft PR17.

## Reviewed trust boundaries

- A bearer session and active tenant membership determine upload/read ownership.
  Request headers cannot select another account. Invalid session and tenant
  cases are covered by HTTP tests.
- PostgreSQL composite keys bind payload revisions and audit entries to their
  tenant. Negative SQL tests exercise foreign-tenant audit injection, version
  reassignment, executable MIME, traversal filenames and premature ready status.
- Rights consent is versioned and stored with each upload. It is an uploader
  attestation, not proof of copyright ownership or legal permission.
- Raw uploads stay quarantined and are never served. Binary signatures are
  rejection gates, not a safety verdict. Publication requires a bounded trusted
  review result after decoding/re-encoding.
- Workers use token/expiry fencing. Tests cover stale retry, superseded
  revision, consent withdrawal, duplicate completion and expired lease recovery.
  Replaced pending originals are erased; historical completed derivatives remain
  private until withdrawal.
- Takedown rechecks an active tenant-operator grant in the database transaction.
  Cross-tenant and revoked-role attempts cannot erase another tenant's content.
- Original/derivative storage, body reads, decoder output, protocol access,
  processing duration and tenant payload/item quotas are bounded.
- Browser callbacks resolve current authorization per request. Tokens are not
  persisted or placed in URLs. Blob preview URLs are revoked on close, withdrawal
  or identity change; asynchronous results are fenced by client generation.
- All private API responses deny shared caching. Active media content is limited
  to fixed re-encoded image/audio/video formats with nosniff/sandbox headers.

## Observed validation

The exact-head GitHub validate check passed for
[a4403385f3221271a273e8db2eaaa94a26e733f0](https://github.com/neophilism/Live-Competition-Engine/actions/runs/41337506365/job/124940327515).
Its pipeline includes migrations, seed, full typecheck, tests and build.
Later commits require their own exact-head evidence; do not carry this pass forward.

Local validation passed full typecheck/build, the media policy/HTTP/worker tests,
generated FFmpeg image/audio/video fixtures, web client tests and PostgreSQL-
compatible PGlite migration/persistence tests. The PGlite harness serialized
transactions; it does not establish native PostgreSQL cross-connection behavior.
The checked-in integration test also runs against PostgreSQL in GitHub CI.

## Remaining acceptance and deployment boundaries

- Production worker isolation and a trusted safety reviewer are not provisioned
  or claimed. An absent reviewer must retain quarantine. No allow-all production
  reviewer exists.
- The reusable media component needs the downstream application's signed-in
  identity host. It is not mounted to an anonymous route with a hardcoded token.
- Full browser rendering/focus/playback acceptance is unverified: no installed
  Chromium binary was available. No screenshot or accessibility audit is claimed.
- Application-wide throttling, operational retention, public sharing,
  transcoder patch management and production monitoring remain deployment/
  hardening concerns. Current bounded private storage is not a public media CDN.
- Withdrawal prevents future server delivery and clears stored payloads, but
  cannot recall a copy already downloaded.
- Conflicts with other units' numbered migrations must be reconciled through
  the approved integration gateway before a verified merge.

