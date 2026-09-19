# Users module implementation

## Objective

Implement the approved Users management PDR as reviewable ODD work units on `feat/users-module`, preserving the
repository's feature, persistence, HTTP, OpenAPI, and E2E boundaries.

## Source of truth

- Product requirements: `docs/prd/users/management/users-management-pdr.md`
- Preliminary notes: `docs/plans/users/users-module-definition-notes.md`
- Workflow: ODD only; SDD is excluded for this repository.

## Delivery rules

- Complete tasks in dependency order.
- Keep behavior, tests, migrations, and relevant documentation in the same work-unit commit.
- Run each task's focused checks before its work-unit commit.
- Record the resulting commit identity under that task.
- Do not push or open a pull request without explicit user authorization.
- Treat experimental `QUERY` as compatibility-gated; do not weaken the approved contract without a demonstrated stack
  limitation and a user decision.

## Tasks

### [x] USERS-0 — Record the approved product baseline

**Status:** Complete.

**Outcome:** The approved Users PDR is versioned as the implementation baseline. The repository-local ODD plan remains
mirrored in Engram and under `odd/`, which this worktree excludes through `.git/info/exclude`.

**Allowed edit surfaces:**

- `docs/prd/users/management/users-management-pdr.md`
- `odd/tasks/users-module.md` for local task-state evidence only

**Checks:**

- `pnpm exec prettier --check docs/prd/users/management/users-management-pdr.md odd/tasks/users-module.md`
- `pnpm exec markdownlint-cli2 docs/prd/users/management/users-management-pdr.md odd/tasks/users-module.md`

**Planned commit:** `docs(users): approve management requirements`

**Evidence:** Commit `86462a3` (`docs(users): approve management requirements`). Prettier, markdownlint, and the
repository `lint-staged` workflow passed without content drift.

### [x] USERS-1 — Establish database runtime and isolated E2E infrastructure

**Status:** Complete.

**Depends on:** USERS-0.

**Outcome:** PostgreSQL 16 and Prisma are available through typed NestJS infrastructure, committed migrations, and
isolated real-database E2E lifecycle support.

**Allowed edit surfaces:**

- `package.json`
- `pnpm-lock.yaml`
- `prisma/**`
- `src/config/database.config.ts`
- `src/database/**`
- `src/app.module.ts`
- `test/support/e2e-environment.ts`
- `test/support/e2e-context.ts`
- `test/support/create-e2e-application.ts`
- `test/support/*database*.ts`
- `vitest.config.e2e.ts`
- `.github/workflows/ci.yml`
- `docs/configuration/database.md`
- `odd/tasks/users-module.md`

**Checks:** Focused database/configuration tests, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and
`pnpm lint:md`.

**Planned commit:** `feat(database): add Prisma runtime and isolated E2E database`

**Risk:** High review workload. Keep runtime, migration execution, and isolated E2E lifecycle in one coherent
infrastructure unit; reassess the diff before committing.

**Evidence:** Commit `2620a92` (`feat(database): add Prisma runtime and isolated E2E database`) and bounded correction
commit `8a0a3ca` (`fix(testing): reject unsafe E2E database URL overrides`). Focused database tests passed, the full
unit suite passed (230), and the full E2E suite passed (34) against an ephemeral PostgreSQL 16 container. Lint, build,
Prettier, Markdownlint, and `lint-staged` passed. Native RDD lineage `review-dc3b6df2e392b2af` identified and validated
the URL-query override fix, approved the corrected candidate, and was acknowledged with burned authority.

### [x] USERS-2 — Create users through the public API

**Status:** Complete.

**Depends on:** USERS-1.

**Outcome:** The initial User persistence model and `POST /api/v1/users` implement approved email, display-name, UUIDv4,
timestamp, conflict, response, Location, serialization, and OpenAPI behavior.

**Allowed edit surfaces:**

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/modules/users/**`
- `src/database/generated/**` (generated-only output from `pnpm exec prisma generate`)
- `src/common/error-handling/application-error.ts`
- `src/common/error-handling/application-error.spec.ts`
- `src/common/error-handling/http-error-mapping.ts`
- `src/common/error-handling/http-error-mapping.spec.ts`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `src/app.module.ts`
- `test/modules/users/**`
- `test/main.e2e-spec.ts`
- `test/common/openapi/openapi.e2e-suite.ts`
- `odd/tasks/users-module.md`

**Checks:** Focused Users creation tests, focused Users E2E scenario, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and
`pnpm build`.

**Planned commit:** `feat(users): create users through the public API`

**Risk:** High review workload because this is the first complete public persistence feature and expands the OpenAPI
surface.

**Resolved decisions:** Count `displayName` length by Unicode code points, permit exactly one ASCII space between letter
groups, and reject repeated internal spaces. The developer authorized adding `test/common/openapi/openapi.e2e-suite.ts`
to the task because its closed path expectation must include the new Users OpenAPI operation. The developer also
authorized regenerating `src/database/generated/**` so the repository can use the typed Prisma `User` delegate instead
of raw SQL.

**Evidence:** Implementation is staged as normalized target
`sha256:d0fa5239b6f23fc3dcd746cbefd80c379d2a78d2f6adabe1c7c9f72a58478fd9`. A project-convention and configured-skill
audit found six issues; all were corrected and independently verified. Two runtime E2E blockers in request schema
metadata and Prisma driver-adapter conflict metadata were corrected through focused Strict TDD. Subsequent
developer-requested corrections added a repository port/Prisma adapter boundary, a canonical application `User`
contract, current Zod 4 format APIs, and composed single-owner field schemas. Final verification passed `pnpm lint`,
`pnpm test` (39 files, 268 tests), `pnpm build`, `pnpm test:e2e` (40 tests against local PostgreSQL 16), two stable
`pnpm lint-staged` runs, and `git diff --cached --check`. Native inspection stopped because RDD is disabled. Work-unit
commit `c39121c` (`feat(users): create users through the public API`) completed the task; the actual pre-commit workflow
was content-stable.

### [x] USERS-3 — Retrieve users by public identifier

**Status:** Complete.

**Depends on:** USERS-2.

**Outcome:** `GET /api/v1/users/:userId` validates UUIDv4 identifiers, returns the public User representation, and maps
missing users to `RESOURCE_NOT_FOUND`.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `test/modules/users/**`
- `test/common/openapi/openapi.e2e-suite.ts`
- `odd/tasks/users-module.md`

**Checks:** Focused retrieval unit/E2E tests, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.

**Planned commit:** `feat(users): retrieve a user by identifier`

**Resolved decisions:** The developer authorized adding `test/common/openapi/openapi.e2e-suite.ts` because its closed
path and operation expectations must include the new public retrieval route.

**Evidence:** Implementation and independent verification passed `pnpm lint`, `pnpm test` (39 files, 275 tests),
`pnpm build`, `pnpm test:e2e` (43 tests against local PostgreSQL 16), `pnpm lint:md`, and `git diff --check`. Two
`pnpm lint-staged` passes were content-stable, and the actual pre-commit hook produced the same tree. Work-unit commit
`755dd96` (`feat(users): retrieve a user by identifier`) completed the task.

### [x] USERS-4 — Partially update users

**Status:** Complete.

**Depends on:** USERS-2 and USERS-3.

**Outcome:** `PATCH /api/v1/users/:userId` changes only supplied mutable fields, normalizes email, rejects null and
system-managed fields, preserves `createdAt`, updates `updatedAt`, and handles conflicts and missing users.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `test/modules/users/**`
- `test/common/openapi/openapi.e2e-suite.ts`
- `test/support/create-e2e-application.ts`
- `odd/tasks/users-module.md`

**Checks:** Focused update unit/E2E tests, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.

**Planned commit:** `feat(users): partially update users`

**Resolved decisions:** A no-op PATCH returns `200` without advancing `updatedAt`, because no persisted mutable value
changed. The developer authorized a typed per-scenario `rateLimitConfig` override in
`test/support/create-e2e-application.ts` so the real HTTP conflict flow can create two users and patch one without
weakening the global E2E default. The developer also authorized updating the closed OpenAPI E2E contract for the new
PATCH operation.

**Evidence:** Focused and independent verification passed `pnpm lint`, `pnpm test` (40 files, 293 tests), `pnpm build`
(57 files, no TypeScript issues), `pnpm test:e2e` (51 tests against local PostgreSQL 16), `pnpm lint:md`, and
`git diff --check`. A task-scoped independent review found no USERS-4 defects. Two `pnpm lint-staged` passes were
content-stable, and the actual pre-commit hook produced the same tree. Work-unit commit `ce32b52`
(`feat(users): partially update users`) completed the task.

### [x] USERS-5 — Delete users permanently

**Status:** Complete.

**Depends on:** USERS-2 and USERS-3.

**Outcome:** `DELETE /api/v1/users/:userId` physically removes a user, returns an empty `204`, and makes subsequent
retrieval return `RESOURCE_NOT_FOUND`.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `test/modules/users/**`
- `test/common/openapi/openapi.e2e-suite.ts`
- `odd/tasks/users-module.md`

**Checks:** Focused deletion unit/E2E tests, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.

**Planned commit:** `feat(users): delete users permanently`

**Resolved decisions:** DELETE for an already-absent user, including a repeated DELETE, returns
`404 RESOURCE_NOT_FOUND`; idempotency applies to the resulting absent state, not an invariant response status. The
developer authorized updating the closed OpenAPI E2E contract for DELETE.

**Evidence:** Focused and independent verification passed `pnpm lint`, `pnpm test` (40 files, 299 tests), `pnpm build`
(no TypeScript issues), `pnpm test:e2e` (54 tests against local PostgreSQL 16), `pnpm lint:md`, and `git diff --check`.
The independent review found no USERS-5 defects. Two `pnpm lint-staged` passes were content-stable, and the actual
pre-commit hook produced the same tree. Work-unit commit `0cce493` (`feat(users): delete users permanently`) completed
the task.

### [x] USERS-6 — List users with conventional cursor queries

**Status:** Complete.

**Depends on:** USERS-2.

**Outcome:** `GET /api/v1/users` supports exact normalized-email filtering, approved sorting, deterministic UUID
tie-breaking, opaque bidirectional cursors, approved limits, and rejection of unsupported filters or sorts.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `test/modules/users/**`
- `test/common/openapi/openapi.e2e-suite.ts`
- `docs/prd/users/management/users-management-pdr.md`
- `docs/api/pagination.md`
- `odd/tasks/users-module.md`

**Checks:** Focused listing/pagination unit and E2E tests, `pnpm lint`, `pnpm test`, full `pnpm test:e2e`, and
`pnpm build`.

**Planned commit:** `feat(users): list users with cursor pagination`

**Risk:** High review workload because bidirectional cursor behavior must remain deterministic for every supported sort
and direction.

**Resolved decisions:** The query grammar is `sort=createdAt|displayName`, `direction=asc|desc`, integer `limit` from 1
through 250 with default 25, and mutually exclusive `after`/`before`; unknown parameters are rejected. The default is
`createdAt desc`, and the UUID tiebreaker follows the primary direction. Cursors are opaque base64url payloads,
versioned, limited to 1024 characters, validated as untrusted input, and originally bound to the active email filter,
sort, and direction; USERS-CURSOR-1 later removed email from the payload and compatibility check, leaving only sort and
direction bound. Malformed or incompatible cursors return `400 BAD_REQUEST`. Page flags reflect actual rows on each
side, cursors are emitted only for existing adjacent pages, and empty pages expose no cursors with both flags false. The
developer authorized updating the PDR and pagination owner, closed OpenAPI E2E expectations, and adding compound
`(createdAt, id)` and `(displayName, id)` indexes through a committed migration.

**Evidence:** Focused TDD and independent high-risk verification passed `pnpm lint`, `pnpm test` (42 files, 322 tests),
Prisma schema validation, `pnpm build` (no TypeScript issues), full `pnpm test:e2e` (57 tests against local PostgreSQL
16), `pnpm lint:md`, and `git diff --check`. The final audit found no USERS-6 defects across cursor parsing, query
shapes, bidirectional navigation, page flags, OpenAPI, migrations, documentation, or real HTTP behavior. Two
`pnpm lint-staged` passes were content-stable, and the actual pre-commit hook produced the same tree. Work-unit commit
`bde9bb0` (`feat(users): list users with cursor pagination`) completed the task.

### [x] USERS-7 — Add the experimental structured QUERY operation

**Status:** Complete.

**Depends on:** USERS-6.

**Outcome:** Experimental `QUERY /api/v1/users` provides the approved exact-email query with the same pagination,
sorting, response, safety, and idempotency semantics as `GET`, without replacing it.

**Compatibility gate:** Before implementation, verify the installed NestJS HTTP adapter and Swagger stack can route
`QUERY` and represent the operation under the repository's required OpenAPI 3.2 contract. If they cannot, stop and
present the demonstrated limitation; do not silently introduce `POST /users/search` or weaken the approved PDR.

**Allowed edit surfaces:**

- `src/modules/users/**`
- `src/common/openapi/openapi-schema.ts`
- `src/common/openapi/openapi.setup.ts`
- `src/common/openapi/openapi.setup.spec.ts`
- `test/modules/users/**`
- `test/common/openapi/openapi.e2e-suite.ts`
- `docs/api/openapi.md`
- `docs/prd/users/management/users-management-pdr.md`
- `package.json` only if an approved compatibility change requires it
- `pnpm-lock.yaml` only with the corresponding approved dependency change
- `odd/tasks/users-module.md`

**Checks:** QUERY compatibility proof, focused QUERY unit/E2E tests, `pnpm lint`, `pnpm test`, full `pnpm test:e2e`,
`pnpm build`, and `pnpm lint:md` when documentation changes.

**Planned commit:** `feat(users): add experimental structured user queries`

**Risk:** High and compatibility-gated because the current OpenAPI surface is 3.0 while `docs/api/openapi.md` requires
OpenAPI 3.2 whenever `QUERY` is exposed.

**Resolved decisions:** QUERY requires a strict JSON body with mandatory `criteria.email`; sorting, direction, limit,
and one optional cursor are also body fields, while every URL query parameter is rejected. It reuses the USERS-6 listing
service, repository, cursor, response, and pagination semantics. The developer authorized updating the PDR, OpenAPI
policy, and closed OpenAPI E2E contract while keeping QUERY scenarios in the existing Users E2E owner.

**Compatibility evidence:** Node.js v26.9.0 exposes `QUERY` in `node:http.METHODS` and a live local HTTP probe accepted
and echoed the method. NestJS 12.0.1 exposes `RequestMethod.QUERY` and `QueryMethod`; Express 5.2.1 derives method
routing from Node's method list; the Swagger runtime scanner emits the lowercase `query` operation; and bundled Swagger
UI 5.32.14 explicitly recognizes `query`. The implementation must preserve current generated schemas while narrowly
publishing the document as OpenAPI 3.2, because enabling Swagger's native 3.2 path mutates nullable schemas.

**Evidence:** Compatibility proof, focused TDD, and independent high-risk verification passed `pnpm lint`, `pnpm test`
(42 files, 337 tests), `pnpm build` (61 files, no TypeScript issues), full `pnpm test:e2e` (59 tests against local
PostgreSQL 16), `pnpm lint:md`, and `git diff --check`. The final audit found no USERS-7 defects in method routing,
strict body validation, reuse, idempotency, serialization, OpenAPI 3.2 QUERY representation, or recursive nullable
conversion. Two `pnpm lint-staged` passes were content-stable, and the actual pre-commit hook produced the same tree.
Work-unit commit `ec98171` (`feat(users): add experimental structured user queries`) completed the task.

## Delivery forecast

- Planned work units: 8.
- High-risk units: USERS-1, USERS-2, USERS-6, and USERS-7.
- Expected delivery: one feature branch with one work-unit commit per completed task.
- Review-size action: assess each high-risk unit before implementation and split only along honest, behavior-complete
  boundaries if its review surface is too large.
