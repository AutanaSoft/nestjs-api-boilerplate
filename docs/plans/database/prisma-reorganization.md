# Reorganize Prisma assets under the database boundary

This plan colocates Prisma schema assets, migrations, generated client code, and future seed sources
under `src/database/` while keeping `prisma.config.ts` at the repository root for automatic Prisma
CLI discovery. The change preserves the database schema and runtime behavior while consolidating the
disposable pre-release migration history into one accepted initial migration.

## Target structure

```text
prisma.config.ts

src/database/
├── database.module.ts
├── prisma.service.ts
├── generated/
└── prisma/
    ├── schema.prisma
    ├── models/
    │   └── user.prisma
    ├── migrations/
    │   ├── migration_lock.toml
    │   └── <timestamp>_initial/
    ├── seed.ts
    └── seeds/
        ├── index.ts
        └── users.seed.ts
```

`prisma.config.ts` remains at the repository root. Prisma ORM supports custom config locations when
every invocation supplies `--config`, but the root location is the conventional and automatically
discovered path. Paths declared in the config are resolved relative to that file.

## Decisions

| Area             | Decision                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| Prisma config    | Keep `prisma.config.ts` at the repository root.                                        |
| Schema location  | Configure the schema directory as `src/database/prisma`.                               |
| Models           | Store each Prisma model in an independent file under `prisma/models/`.                 |
| Prisma API names | Keep model fields camelCase for generated TypeScript APIs.                             |
| Database names   | Map tables, columns, constraints, and indexes to PostgreSQL snake_case names.          |
| Migrations       | Consolidate the pre-release history into one initial migration.                        |
| Generated client | Keep generated output in `src/database/generated/`.                                    |
| Seed entry point | Use `src/database/prisma/seed.ts`.                                                     |
| Seed modules     | Organize deterministic seed functions by feature under `prisma/seeds/`.                |
| Seed runtime     | Execute TypeScript directly with `tsx`.                                                |
| Seed execution   | Require an explicit `prisma db seed`; never run it during startup or migration deploy. |
| E2E data         | Keep E2E fixtures independent from development seeds.                                  |

## Ownership boundaries

- `src/config/database.config.ts` validates and exposes the runtime database URL.
- Root `prisma.config.ts` owns Prisma CLI paths and the seed command.
- `src/database/prisma/schema.prisma` owns the generator and datasource declarations.
- `src/database/prisma/models/*.prisma` own persistence models and Prisma enums.
- `src/database/prisma/migrations/` owns immutable migration history.
- `src/database/prisma/seed.ts` owns seed process startup, safety checks, and cleanup.
- `src/database/prisma/seeds/*.seed.ts` own feature-specific development data.
- `src/database/generated/` contains generated code and must not be edited manually.
- `src/database/prisma.service.ts` owns application client construction and NestJS lifecycle hooks.
- Feature repositories own queries and persistence-to-domain mapping.

Prisma models remain persistence contracts. They must not replace application models, HTTP request
schemas, or response schemas.

## Expected Prisma configuration

The root config will load `.env` explicitly and point Prisma at the relocated schema directory:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'src/database/prisma',
  migrations: {
    path: 'src/database/prisma/migrations',
    seed: 'tsx src/database/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

The schema entry file will keep only shared declarations:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}
```

The relative generator output is recalculated from the relocated `src/database/prisma/schema.prisma`
file and must continue to resolve to `src/database/generated/`.

## Physical database naming

Prisma model and field names remain idiomatic TypeScript while `@map` and `@@map` define explicit
PostgreSQL identifiers. The initial User model will follow this shape:

```prisma
model User {
  id          String   @id(map: "users_pkey") @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email       String   @unique(map: "users_email_key")
  displayName String   @map("display_name")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@index([createdAt, id], map: "users_created_at_id_idx")
  @@index([displayName, id], map: "users_display_name_id_idx")
  @@map("users")
}
```

The generated Prisma API continues to expose `User`, `displayName`, `createdAt`, and `updatedAt`.
PostgreSQL stores the table as `users` and its mapped columns as `display_name`, `created_at`, and
`updated_at`. The initial migration and trigger SQL must reference these physical names.

## Seed design

### Entry point

`seed.ts` will run as an independent CLI process. It must not bootstrap the NestJS application or
reuse `PrismaService`.

The entry point will:

1. Require an explicit development seed intent.
2. Reject production and test environments before creating a client.
3. Reuse `buildDatabaseConfig()` to validate `DATABASE_URL`.
4. Construct `PrismaPg` and the generated `PrismaClient` directly.
5. Execute the ordered seed orchestrator.
6. Disconnect in `finally`.
7. Return a non-zero exit code on failure without logging the connection URL or secrets.

### Seed modules

Each feature seed will export one focused function that receives the Prisma client. Seed operations
must:

- use stable unique keys and `upsert` where possible;
- be safe to execute repeatedly;
- avoid random identifiers, timestamps, and credentials unless the requirement demands them;
- use transactions when related writes must succeed atomically;
- avoid `deleteMany()`, resets, or implicit destructive cleanup;
- keep update behavior explicit so reruns do not silently overwrite developer data.

The initial implementation will create the seed infrastructure without adding default users,
passwords, tokens, or other credentials. Feature data requires a separate functional requirement.

### Environment boundary

The development seed and E2E fixtures serve different purposes:

| Development seed             | E2E fixture                           |
| ---------------------------- | ------------------------------------- |
| Invoked manually             | Created per isolated scenario         |
| Stable, reusable local data  | Scenario-specific data                |
| Idempotent across runs       | Destroyed with the temporary database |
| Uses `prisma db seed`        | Prefers public HTTP setup             |
| Never runs during deployment | Runs only inside the E2E lifecycle    |

An environment label cannot prove that a connection URL is safe. The command therefore remains an
explicit operator action and must not be attached to application startup, `migrate deploy`, or the
E2E bootstrap.

## Migration baseline policy

The project is still in development: no production or shared database depends on the current
migration identifiers, and development data is disposable. The empty baseline, User table migration,
and listing-index migration will therefore be replaced by one initial migration representing the
accepted starting state.

The consolidated migration must preserve all current behavior while adopting the approved physical
naming convention:

- the `users` table and `users_pkey` primary key;
- the `users_email_key` unique email index;
- the `users_created_at_id_idx` and `users_display_name_id_idx` listing indexes;
- the `set_user_updated_at()` PostgreSQL function;
- the `user_updated_at` trigger;
- the trigger condition over `email` and `display_name`;
- assignment of the `updated_at` column.

The trigger and function are handwritten SQL that Prisma cannot derive completely from the schema.
The initial migration must retain them explicitly rather than relying only on generated migration
SQL. After this baseline is accepted, all later schema changes create immutable incremental
migrations.

Consolidation requires recreating disposable development databases because their applied migration
identifiers will no longer match the repository history. This destructive action occurs only during
implementation, after explicit confirmation immediately before execution. The recreated database is
then migrated from the new baseline and populated through the explicit development seed workflow.

## Implementation phases

### Phase 1: lock the current database contract

1. Record the current schema, generated client surface, migration SQL, indexes, function, and
   trigger.
2. Add focused checks that prove Prisma exposes the existing `User` model after relocation.
3. Preserve the trigger test while removing its dependency on the old migration directory name.
4. Confirm the current history applies successfully to an isolated PostgreSQL database.

Exit criterion: table, indexes, trigger behavior, and generated client have reproducible checks
before migration history changes.

### Phase 2: create the initial migration and relocate schema assets

1. Create `src/database/prisma/`.
2. Move generator and datasource declarations to `src/database/prisma/schema.prisma`.
3. Move `User` to `src/database/prisma/models/user.prisma` and add the approved table, column,
   constraint, and index mappings.
4. Point root `prisma.config.ts` at the schema directory and relocated migrations.
5. Remove the three disposable pre-release migration directories.
6. After explicit destructive confirmation, recreate the disposable development database so its
   applied migration identifiers cannot conflict with the new baseline.
7. Run `prisma migrate dev --name initial --create-only` to generate the schema-derived migration.
8. Review the generated SQL identifiers and append the handwritten function and trigger SQL using
   `users`, `display_name`, and `updated_at`.
9. Apply the reviewed initial migration with `prisma migrate dev`.
10. Update direct migration paths and SQL assertions in tests and documentation.

The migration must be generated with `--create-only` first. A plain one-step
`migrate dev --name initial` would apply the generated SQL before the handwritten trigger is added
and would not produce the accepted complete baseline.

Exit criterion: Prisma validates the multifile schema and a clean isolated database reaches the
complete accepted state from the reviewed single initial migration.

### Phase 3: regenerate the client

1. Recalculate the generator output relative to the relocated schema.
2. Run Prisma generation rather than editing generated files.
3. Confirm existing service and repository imports remain valid.
4. Verify that regenerated output introduces no semantic model changes.

Exit criterion: the generated client remains at `src/database/generated/` and exposes the same API.

### Phase 4: add seed infrastructure

1. Add `tsx` as a development dependency.
2. Configure `migrations.seed` in root `prisma.config.ts`.
3. Add the guarded standalone `seed.ts` entry point.
4. Add the ordered seed orchestrator under `seeds/index.ts`.
5. Add a `prisma:seed` package script that invokes `prisma db seed` explicitly.
6. Leave feature seed data empty until requirements define the records to create.

Exit criterion: the seed command starts safely, rejects forbidden environments, and succeeds as a
no-op against an eligible migrated development database.

### Phase 5: update project references

Review and update, as required:

- `package.json` and `pnpm-lock.yaml`;
- `test/support/e2e-database.ts`;
- `src/modules/users/users-migration.spec.ts`;
- `docs/configuration/database.md`;
- `docs/architecture/data-access.md`;
- `docs/architecture/project-structure.md`;
- `docs/testing/e2e-testing.md`;
- `README.md`.

Exit criterion: no repository reference expects a root `prisma/` directory, while `prisma.config.ts`
remains discoverable at the root.

### Phase 6: verify behavior and operational safety

1. Validate and format the multifile Prisma schema.
2. Generate the client and verify that a second generation is content-stable.
3. Check migration status against an isolated PostgreSQL database.
4. Run unit, build, lint, and E2E verification.
5. Run the development seed twice and confirm stable data with no duplicates.
6. Confirm production and test seed attempts fail before any write.

Exit criterion: the relocation changes paths only, and the seed workflow is explicit, repeatable,
and isolated from E2E.

## Files expected to change

### Relocated

- `prisma/schema.prisma` to `src/database/prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml` to `src/database/prisma/migrations/migration_lock.toml`

### Replaced

- the three pre-release migration directories with one
  `src/database/prisma/migrations/<timestamp>_initial/migration.sql`

### New

- `src/database/prisma/models/user.prisma`
- `src/database/prisma/seed.ts`
- `src/database/prisma/seeds/index.ts`
- focused seed safety tests

### Modified

- `prisma.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- path-dependent migration tests and E2E support
- database architecture, configuration, testing, and setup documentation
- generated Prisma client output

### Removed after validation

- the empty root `prisma/` directory;
- model declarations duplicated in `schema.prisma`.

## Risks and mitigations

| Risk                                             | Mitigation                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Prisma fails to assemble the multifile schema    | Validate the directory before removing old paths.                 |
| Generator writes to an unintended directory      | Assert the resolved output and inspect regenerated paths.         |
| Initial migration omits handwritten behavior     | Assert the indexes, function, and trigger SQL and behavior.       |
| Local database retains obsolete migration IDs    | Recreate it only with explicit destructive-action confirmation.   |
| A test or deployment script retains the old path | Search the repository and require explicit path checks.           |
| Generated client becomes stale                   | Regenerate and require a content-stable second generation.        |
| Seed runs against production                     | Reject production explicitly and keep invocation manual.          |
| Seed duplicates or overwrites local data         | Use stable keys, idempotent operations, and explicit updates.     |
| Development seed leaks into E2E                  | Keep E2E lifecycle and fixture creation independent.              |
| Default credentials enter the repository         | Add no credential-bearing records without a separate requirement. |

## Acceptance criteria

- [ ] Root `prisma.config.ts` remains automatically discoverable.
- [ ] The config explicitly loads `.env` and validates `DATABASE_URL` through Prisma's `env` helper.
- [ ] Prisma schema assets live under `src/database/prisma/`.
- [ ] Each persistence model has an independent file under `prisma/models/`.
- [ ] Prisma APIs remain camelCase while PostgreSQL identifiers use explicit snake_case mappings.
- [ ] The User model maps to `users`; mapped columns are `display_name`, `created_at`, and
      `updated_at`.
- [ ] Primary key, unique constraint, and listing indexes use explicit snake_case names.
- [ ] The assembled schema preserves the current application-facing model and datasource behavior.
- [ ] The three pre-release migrations are replaced by one initial migration.
- [ ] The initial migration is generated with `--create-only`, reviewed, extended with the function
      and trigger, and only then applied.
- [ ] The initial migration preserves the table, indexes, function, trigger, and trigger condition.
- [ ] Applying the initial migration to an empty database reproduces the accepted starting state.
- [ ] Subsequent migrations are treated as immutable incremental history.
- [ ] Generated client output remains under `src/database/generated/`.
- [ ] Existing `PrismaService` and repository imports remain valid.
- [ ] `prisma db seed` is configured and explicitly invoked.
- [ ] Seed code uses the PostgreSQL adapter and generated Prisma client directly.
- [ ] Seed execution is idempotent and rejects production and test environments before writes.
- [ ] No default accounts or credentials are added without an approved requirement.
- [ ] Development seeds remain separate from E2E fixtures.
- [ ] No repository reference expects the old root `prisma/` path.
- [ ] Documentation describes the new layout and operator workflow.
- [ ] Formatting, lint, build, unit tests, E2E tests, Prisma checks, and migration checks pass.

## Verification

Run focused checks throughout the migration and the complete suite before closing it:

```bash
pnpm exec prisma validate
pnpm exec prisma format
pnpm prisma:generate
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
pnpm exec prettier --check .
pnpm lint:md
git diff --check
```

Database-connected migration and seed checks must target an isolated local PostgreSQL instance:

```bash
pnpm exec prisma migrate status
pnpm prisma:seed -- --environment development
pnpm prisma:seed -- --environment development
```

The second seed run must produce no duplicates or unexpected updates.

## Out of scope

- Changing the current database schema or public API.
- Rewriting migration history again after the initial development baseline is accepted.
- Resetting production, staging, shared, or data-bearing databases.
- Adding production seed automation.
- Running seeds during application startup, deployment, or E2E bootstrap.
- Adding default users, passwords, roles, tokens, or credentials.
- Replacing feature repositories with direct Prisma access from services.
