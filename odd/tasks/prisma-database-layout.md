# Prisma database layout

## Objective

Implement `docs/plans/database/prisma-reorganization.md`: colocate Prisma schema assets under the database boundary,
adopt explicit PostgreSQL snake_case mappings, establish one reviewed initial migration, and add an explicit safe
development seed workflow without changing application-facing contracts.

## Delivery

- **Branch:** `refactor/prisma-database-layout`
- **Strategy:** `ask-on-risk`
- **Forecast:** approximately 300 authored changed lines, excluding generated Prisma Client output
- **TDD mode:** disabled by explicit user choice
- **Verification runner:** ordinary project checks with Vitest, Prisma CLI, lint, build, and E2E
- **Route:** delegated direct; the multi-file writer trigger applies

## Scope

### [x] PRISMA-LAYOUT-1 — Relocate and baseline Prisma schema assets

**Status:** Complete.

**Outcome:** Root `prisma.config.ts` discovers a multifile schema under `src/database/prisma/`; the User model keeps
camelCase Prisma APIs while mapping to explicit snake_case PostgreSQL identifiers; three disposable migrations become
one reviewed initial migration; generated client and all path references remain valid.

**Allowed edit surfaces:**

- `prisma.config.ts`
- `prisma/**`
- `src/database/prisma/**`
- `src/database/generated/**`
- `src/modules/users/users-migration.spec.ts`
- `test/support/e2e-database.ts`
- `docs/architecture/data-access.md`
- `docs/architecture/project-structure.md`
- `docs/configuration/database.md`
- `docs/testing/e2e-testing.md`
- `README.md`
- `odd/tasks/prisma-database-layout.md`

**Constraints:**

- Keep `prisma.config.ts` at the repository root and load `.env` explicitly.
- Do not reset, drop, or mutate an existing development, shared, staging, or production database.
- Generate or reconstruct the baseline only against an empty disposable target; preserve and review the handwritten
  function and trigger before application.
- Preserve application-facing Prisma field names and all existing repository behavior.
- Do not edit generated client files manually.

**Implementation note:** The initial migration was reconstructed deterministically from the approved schema and the
three disposable migration SQL files because no separate empty disposable target was available without risking the
configured database. Its schema-derived table and index SQL was checked with
`prisma migrate diff --from-empty --to-schema src/database/prisma --script`; the handwritten function and trigger were
reviewed against the approved physical names and exercised through the isolated E2E database lifecycle.

**Checks:** Prisma validate/format/generate, focused migration and repository tests, lint, build, E2E, content-stable
generation, and stale-path search.

**Planned commit:** `refactor(database): reorganize Prisma schema assets`

**Evidence:** Writer relocated the multifile schema, consolidated the initial migration, regenerated the client, and
updated paths/docs. Prisma validation, focused tests (20), lint, build, and isolated E2E (59) pass. Independent
verification found no authored-file defects. The repository now excludes only `src/database/generated/**` from Git
whitespace diagnostics through `.gitattributes`; `git diff --check`, Markdown formatting, Markdown lint, and attribute
checks pass. Historical ODD task references to the prior path are non-operational records and remain intentionally
unchanged. Work-unit commit `a32428f` (`refactor(database): reorganize Prisma schema assets`) completed the task.

### [x] PRISMA-LAYOUT-2 — Add guarded development seed infrastructure

**Status:** Complete.

**Outcome:** Prisma exposes an explicit TypeScript seed command with environment guards, standalone adapter/client
lifecycle, feature-oriented seed orchestration, and no default credential-bearing data. E2E fixtures remain independent.

**Allowed edit surfaces:**

- `prisma.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `src/database/prisma/seed.ts`
- `src/database/prisma/seeds/**`
- `src/database/prisma/**/*.spec.ts`
- `.env.example`
- `docs/configuration/database.md`
- `docs/testing/e2e-testing.md`
- `README.md`
- `odd/tasks/prisma-database-layout.md`

**Constraints:**

- Add `tsx` as a direct development dependency.
- Invoke seeds only through explicit `prisma db seed`.
- Reject production and test before opening a database connection.
- Reuse validated database configuration and the PostgreSQL adapter without bootstrapping NestJS.
- Keep the first seed a safe no-op; add no accounts, passwords, roles, tokens, or credentials.
- Do not run the seed against an existing database without explicit user authorization.

**Checks:** focused guard tests, Prisma config validation, seed no-op against an isolated database, repeat-run
stability, production/test rejection, lint, test, build, and E2E.

**Planned commit:** `feat(database): add guarded Prisma seed workflow`

**Evidence:** Added `tsx` as a direct development dependency, configured the Prisma 7 seed command, implemented the
guarded standalone seed entry point and ordered no-op feature seed orchestrator, and added focused guard/lifecycle
tests. The safe no-op passed with a placeholder unreachable URL; production and test guard commands failed before client
creation without logging connection details. Focused tests (14), unit tests (356), lint, build, isolated E2E (59),
Prisma validation, formatting, Markdown lint, and `git diff --check` passed. No existing development database was used.
Work-unit commit `b845d3b` (`feat(database): add guarded Prisma seed workflow`) completed the task.

## Acceptance criteria

- [x] Root Prisma config resolves the relocated multifile schema and migrations.
- [x] User maps to `users`; physical columns, constraints, and indexes use snake_case.
- [x] One initial migration reproduces table, indexes, function, trigger, and condition.
- [x] Generated client stays under `src/database/generated` with camelCase APIs.
- [x] No repository path expects the removed root `prisma/` directory.
- [x] Seed execution is explicit, guarded, repeatable, and separate from E2E fixtures.
- [x] No existing non-disposable database is reset or mutated during implementation.
- [x] Focused and complete verification checks pass.

## Next step

Implementation is complete. Preserve the two work-unit commits as the review boundary and await the next delivery
instruction.
