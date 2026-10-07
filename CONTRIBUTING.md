# Contributing

## Domain-neutral rule

The core engine models generic live competition concepts. Do not introduce product-specific language such as acting, monologues, rap, or battle culture into core domain names unless the concept is genuinely universal.

Prefer:

- competitor
- performance
- event
- round
- match
- judge
- audience member

Product implementations may map those terms to their own vocabulary.

## Local development

1. Use Node 24 or newer.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Run `npm install`.
5. Run `npm run db:migrate`.
6. Run `npm run dev`.

## Required checks

Before merging:

- `npm run typecheck`
- `npm test`
- `npm run build`

Database changes must be represented as migrations.
