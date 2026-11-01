# ADR: source-bound media CI repair

Status: accepted for a scoped repair attempt; not release or full CI acceptance.

PR17 head 419dc85c070965d3c38fad4696500dd80601e525 has a failed validate check.
The named Boardroom connection exposes its conclusion/job URL, but no CI log
operation. Do not use a separate connector or bypass the fenced gateway.

The immutable authentication migration requires suspended status and
suspended_at to change together. The media integration fixture sets only
suspended_at, violating that check. Update both fields, retain the assertion
that suspended membership cannot upload, and rerun integration validation.
Do not weaken the database constraint or skip the negative test.

Evidence:
- https://github.com/neophilism/Live-Competition-Engine/blob/419dc85c070965d3c38fad4696500dd80601e525/packages/db/migrations/0002_authentication.sql
- https://github.com/neophilism/Live-Competition-Engine/blob/419dc85c070965d3c38fad4696500dd80601e525/packages/db/src/media-library.test.ts
- https://github.com/neophilism/Live-Competition-Engine/actions/runs/41336358314/job/124936912539

Local corrected-fixture PostgreSQL-compatible PGlite persistence test passed,
as did migrations, full typecheck and production build. These are bounded local
diagnostics. They do not identify the exact CI failed step without logs, nor
replace current-head GitHub CI against PostgreSQL. Continue substantive media
implementation and inspect the next head. Keep the PR draft until remaining
acceptance is complete.

