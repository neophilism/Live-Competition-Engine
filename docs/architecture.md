# Architecture

## Governing abstraction

The engine must remain useful when the product-specific vocabulary is unknown.

A proposed core model should pass this test:

> Could the same concept support a poetry slam, dance competition, comedy contest, DJ battle, debate tournament, talent show, esports-style performance event, acting competition, or rap competition without changing its fundamental meaning?

If not, it belongs in an implementation rather than the engine.

## Workspace boundaries

### `apps/web`

HTTP application, operator surfaces, and API endpoints.

### `packages/config`

Validated runtime configuration. Server code should consume configuration through this package instead of reading unvalidated environment variables throughout the codebase.

### `packages/db`

PostgreSQL connection, Drizzle schema, migrations, and development seed data.

## Operational health

`/api/health` is a liveness endpoint. It verifies that the web process can answer HTTP requests without depending on infrastructure.

`/api/ready` is a readiness endpoint. It verifies the database dependency and returns HTTP 503 when the service is not ready to receive traffic.

## Database changes

Schema changes require checked-in migrations. Application startup must not silently modify the schema.

## Future packages

As the roadmap advances, reusable domain and service boundaries should become separate packages only when they have a clear responsibility. PR 1 intentionally avoids inventing abstractions before the competition domain model is introduced.
