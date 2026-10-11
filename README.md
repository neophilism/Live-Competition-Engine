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

## Architecture principle

A core concept belongs in this repository only if it can be described without knowing whether the implementation is a monologue competition, rap battle league, poetry slam, dance contest, debate, talent show, or another live competition format.
