# Database configuration

PostgreSQL 16 is the relational database runtime. Prisma 7 owns the persistence client and applies committed migrations.

## Runtime configuration

`DATABASE_URL` is required at application startup. It must be a PostgreSQL connection URL using the `postgresql://` or
`postgres://` protocol. The value is a secret: provide it through deployment configuration and never log or commit it.

Prisma CLI commands use the root `prisma.config.ts`, which loads `.env`, resolves the same `DATABASE_URL`, and discovers
the multifile schema and migrations under `src/database/prisma/`:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

### Explicit development seed

The root Prisma config registers `tsx src/database/prisma/seed.ts` as the Prisma 7 seed command. Run the seed only
through the explicit development script:

```bash
pnpm prisma:seed
```

This expands to `prisma db seed -- --environment development`. The entry point rejects `NODE_ENV=production` and
`NODE_ENV=test` before creating the PostgreSQL adapter or Prisma client, validates `DATABASE_URL` with
`buildDatabaseConfig()`, and always disconnects after the ordered feature seeds finish. The initial feature seed is
intentionally a no-op: it creates no users, accounts, passwords, roles, tokens, credentials, or other default data, and
it never deletes or resets existing rows. Do not point it at a shared, staging, production, or data-bearing database.

Development seeds are separate from the E2E lifecycle. The E2E harness creates its own temporary database and fixtures;
it never invokes `prisma db seed`.

`src/database/prisma/schema.prisma` defines only the database provider and generated-client output. Persistent models
are split into `src/database/prisma/models/`, and versioned migrations live in `src/database/prisma/migrations/`.
Persistent models and their migrations are owned by the Feature that introduces them.

## End-to-end database lifecycle

`pnpm test:e2e` requires `E2E_DATABASE_ADMIN_URL`. It must point to the loopback PostgreSQL 16 maintenance database
named `postgres`; for example:

```bash
E2E_DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
```

The harness creates an unpredictable temporary database per scenario, applies committed migrations, starts the
production root module with the temporary database URL, then closes NestJS and drops the database with `FORCE`. This
isolates test data from development databases and other scenarios.

CI provisions PostgreSQL 16 and supplies this administrative URL. Local E2E execution requires a compatible loopback
PostgreSQL 16 instance; the harness intentionally rejects remote and non-maintenance administrative URLs.
