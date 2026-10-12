# Live Competition Engine

**Full original 55-milestone development plan:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

Reusable, domain-neutral infrastructure for live competitions with competitors, judges, audiences, events, performances, rounds, monetization, and operator controls.

The engine is intentionally not tied to acting, rap, comedy, dance, debate, or any other specific competition format. Product-specific terminology and presentation belong in separate implementations.

## Foundation

PR 1 establishes:

- Node 24+ workspace structure
- Next.js web application
- strict TypeScript baseline
- PostgreSQL + Drizzle database package
- checked-in migration baseline
- repeatable development seed
- centralized environment validation
- liveness and readiness endpoints
- Vitest unit testing
- GitHub Actions CI
- local PostgreSQL via Docker Compose

## Workspace

```text
apps/
  web/        web application and HTTP endpoints
packages/
  auth/       authentication, scoped roles, and action authorization
  config/     runtime configuration validation
  db/         database connection, schema, migrations, and seed
```

See `docs/architecture.md` for the governing abstraction rule.

Tenant custom-domain claim, DNS proof, and verified-host routing boundaries are documented in [docs/custom-domains.md](docs/custom-domains.md). Live DNS, certificate, and ingress evidence remain deployment gates.

## Local development

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000.

### Health endpoints

- `GET /api/health` — process liveness
- `GET /api/ready` — database-backed readiness

## Validation

```bash
npm run typecheck
npm test
npm run build
```

## Tenant isolation

Tenant-owned relationships are bound to `organization_id` in both authorization and PostgreSQL constraints. See [tenant isolation](docs/tenant-isolation.md) for the invariant required of future media, payment, reporting, and configuration tables.

## Architecture principle

A core concept belongs in this repository only if it can be described without knowing whether the implementation is a monologue competition, rap battle league, poetry slam, dance contest, debate, talent show, or another live competition format.

## End-to-End Everywhere progress

The canonical [security/e2eesa-status.json](security/e2eesa-status.json) records standard implementation, complete testing and independent expert review separately. Engine Room reads it automatically from GitHub. All initial stages are pending; existing profile locks and approved decisions remain authoritative. Read [adoption and independent-account instructions](docs/E2EESA_ADOPTION.md), and run `python3 scripts/validate_e2eesa_status.py`. Record validation does not establish product security or certification.
