# Database configuration

PostgreSQL 16 is the relational database runtime. Prisma 7 owns the persistence client and applies
committed migrations.

## Runtime configuration

`DATABASE_URL` is required at application startup. It must be a PostgreSQL connection URL using the
`postgresql://` or `postgres://` protocol. The value is a secret: provide it through deployment
configuration and never log or commit it.

Prisma CLI commands use `prisma.config.ts`, which resolves the same `DATABASE_URL`:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

`prisma/schema.prisma` defines only the database provider and generated-client output. Persistent
models and their migrations are owned by the Feature that introduces them.

## End-to-end database lifecycle

`pnpm test:e2e` requires `E2E_DATABASE_ADMIN_URL`. It must point to the loopback PostgreSQL 16
maintenance database named `postgres`; for example:

```bash
E2E_DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
```

The harness creates an unpredictable temporary database per scenario, applies committed migrations,
starts the production root module with the temporary database URL, then closes NestJS and drops the
database with `FORCE`. This isolates test data from development databases and other scenarios.

CI provisions PostgreSQL 16 and supplies this administrative URL. Local E2E execution requires a
compatible loopback PostgreSQL 16 instance; the harness intentionally rejects remote and
non-maintenance administrative URLs.
