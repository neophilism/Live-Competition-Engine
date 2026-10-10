# Competition domain model

The engine uses organization-scoped UUID identifiers. A competition contains entries and ordered rounds. Each round contains ordered performances. Judges are assigned per competition, and results may be provisional, final or void.

## Tenant isolation

Every service query MUST filter by authenticated organization ID. SQL foreign keys protect the competition/participant pairing for entries and the competition/round pairing for performances, but they are not a substitute for authorization. Never accept client-supplied organization IDs as authorization. Results should be published only after an authorized operator finalizes them.

## Migration

Run `npm run db:migrate` against a configured PostgreSQL database. Migration 0001 creates the competition-domain tables and indexes. Run the CI PostgreSQL migration and TypeScript checks before merging.

## Next work

PR 3 must implement authentication, organization membership and role checks before write endpoints are exposed. Subsequent PRs add competition state transitions, scoring, judging and live updates.
