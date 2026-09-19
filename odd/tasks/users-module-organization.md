# Users module organization

## Objective

Reorganize the completed Users Feature by responsibility, following `docs/architecture/project-structure.md`, without
changing runtime behavior, contracts, providers, or public APIs.

## Scope

### [x] USERS-ORG-1 — Organize feature files by responsibility

**Status:** Complete.

**Outcome:** Controller, service, and repository implementations and their colocated unit tests live in responsibility
directories. Feature composition, shared feature errors, cursor codec, migration test, and canonical contracts remain at
their justified owners.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `odd/tasks/users-module-organization.md`

**Moves:**

- `users.controller.ts` and its spec to `controllers/`
- `users.service.ts` and its spec to `services/`
- the repository implementation, port, and spec to `repositories/` (renamed by USERS-ORG-2)

**Constraints:**

- Preserve routes, behavior, schemas, provider tokens, exports, and dependency injection.
- Update only imports affected by the moves.
- Do not add DTO, entity, barrel, or empty responsibility directories.
- Keep contracts and their Zod ownership unchanged.

**Checks:** Focused Users tests, `pnpm lint`, `pnpm test`, `pnpm build`, full `pnpm test:e2e`, `pnpm lint:md`, stable
`pnpm lint-staged`, and `git diff --check`.

**Planned commit:** `refactor(users): organize feature files by responsibility`

**Evidence:** The seven approved moves preserved file content except for required relative imports. Independent
verification found no defects and passed `pnpm lint`, `pnpm test` (42 files, 337 tests), `pnpm build` (61 files, no
TypeScript issues), `pnpm test:e2e` (59 tests against local PostgreSQL 16), `pnpm lint:md`, and `git diff --check`. Two
`pnpm lint-staged` passes were content-stable, and the actual pre-commit hook produced the same tree. Work-unit commit
`c5ace7d` (`refactor(users): organize feature files by responsibility`) completed the task.

### [x] USERS-ORG-2 — Clarify repository abstraction and adapter names

**Status:** Complete.

**Outcome:** Repository filenames distinguish the feature-owned abstraction from its Prisma adapter:
`users.repository.ts` owns `UsersRepository`, its token, and query/result types, while `prisma-users.repository.ts` owns
`PrismaUsersRepository` and its colocated spec.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `odd/tasks/users-module-organization.md`

**Constraints:**

- Preserve `UsersRepository`, `USERS_REPOSITORY`, `PrismaUsersRepository`, and provider identity.
- Change only filenames and affected imports; preserve runtime behavior and test semantics.

**Checks:** Focused Users tests, `pnpm lint`, `pnpm test`, `pnpm build`, full `pnpm test:e2e`, `pnpm lint:md`, stable
`pnpm lint-staged`, and `git diff --check`.

**Planned commit:** `refactor(users): clarify repository abstraction and adapter names`

**Evidence:** Independent verification confirmed the final abstraction/adapter ownership, preserved all symbol and
provider identities, found no stale imports or behavior changes, and passed `pnpm lint`, `pnpm test` (42 files, 337
tests), `pnpm build` (61 files, no TypeScript issues), `pnpm test:e2e` (59 tests against local PostgreSQL 16),
`pnpm lint:md`, and `git diff --check`. Two `pnpm lint-staged` passes were content-stable, and the actual pre-commit
hook produced the same tree. Work-unit commit `26823f1`
(`refactor(users): clarify repository abstraction and adapter names`) completed the task.
