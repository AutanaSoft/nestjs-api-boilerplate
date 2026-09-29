# Users implementation plan — approved

This approved plan describes the authenticated transition of the approved
[Users PDR](../../prd/users/management/users-management-pdr.md). Its checked historical unauthenticated criteria remain
valid evidence, **not** approval to retain public CRUD. Coordinate delivery with the
[Auth plan](../auth/implementation-plan.md): the Auth PDR owns Auth HTTP operations, tokens and sessions; this document
owns only Users HTTP behavior. Both plans have received explicit user approval before runtime implementation.

## Starting point and boundaries

`src/modules/users/` currently has a public `POST /users`, a five-field public response, mutable email/display-name
update, and no exported credential API. `src/database/prisma/models/user.prisma` and the sole
`src/database/prisma/migrations/20260918000000_initial/migration.sql` have no role or password hash. Existing
`test/modules/users/create-user.e2e-suite.ts` relies on unauthenticated creation and `test/main.e2e-spec.ts` registers
it. Preserve implemented list/QUERY filters, sorting, cursor semantics and isolation while replacing the temporary
exposure.

Users owns normalization, user persistence, Argon2id hashing/verification, persisted credential state, credential change
and public profile projection. Export a focused application API consumed by Auth for sign-up, sign-in verification,
current safe user lookup and credential change; do **not** export the repository or import Auth. Keep Prisma in
repositories/transaction adapter, not in services. Place a neutral principal contract/request extraction at a common
boundary; Users can receive identity as an argument without importing Auth guards or session implementations. Follow
[data access](../../architecture/data-access.md), [authentication](../../architecture/authentication.md),
[authorization](../../architecture/authorization.md), [serialization](../../architecture/serialization.md),
[validation](../../architecture/validation.md), [HTTP conventions](../../api/http-contracts.md),
[pagination](../../api/pagination.md), [OpenAPI](../../api/openapi.md), and [E2E](../../testing/e2e-testing.md).

## Coordinated work units

<!-- markdownlint-disable MD013 -->

| Unit                               | Dependencies and likely paths                                                                                                                                                                                                                                                         | RED → GREEN and alternate protection                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1 — schema and migration          | Coordinate Auth A1; `src/database/prisma/models/user.prisma`, `src/database/prisma/models/session.prisma`, `src/database/prisma/migrations/20260918000000_initial/migration.sql`, generated client only via Prisma tooling                                                            | RED model/repository tests for persisted sole `user` role, required hash, unique normalized email and delete cascade. GREEN regenerate the **sole initial migration in place under its original name**, not a new migration. Confirm Prisma relation and SQL FK `ON DELETE CASCADE` actually target Auth sessions, with real PostgreSQL test of deletion and rollback. Update timestamp trigger only as needed for changed persisted fields; do not assume schema defaults imply SQL behavior.                    |
| U2 — credential API                | U1, before Auth A2/A3; `src/modules/users/contracts/`, `src/modules/users/services/`, `src/modules/users/repositories/{users.repository,prisma-users.repository}.ts`, `src/modules/users/users.module.ts`, `src/modules/users/users.errors.ts`, `package.json`, `pnpm-lock.yaml`      | RED tests for email normalization and conflict, untrimmed 12-character enrollment minimum, raw nonempty old password accepted for verification, wrong-password equivalence at Auth boundary, role fixed to persisted `user`, safe lookup excluding hash. GREEN Users-local Argon2id provider and narrow exported methods; verify installed `argon2` API/version and parameters before coding. Reject role/unknown input and prevent hashes entering transport/logs. Do not export repository.                     |
| U3 — protected Users HTTP          | Auth A4 guard/principal; `src/modules/users/controllers/users.controller.ts`, `src/modules/users/contracts/{create-user-request,update-user-request,user-response,list-users-response}.schema.ts`, `src/modules/users/services/users.service.ts`, `src/modules/users/users.errors.ts` | RED HTTP for every route without token, cross-account write, missing target, strict owner update and viewer-specific profile. GREEN remove `POST /users`, add `/users/me` GET/PATCH before `:userId`, require authentication for GET/list/QUERY/PATCH/DELETE, allow all authenticated reads, owner-only writes and explicit Zod projection. Resolve resource existence before forbidden/not-found distinction for authenticated writes; avoid leaking hashes.                                                     |
| U4 — deletion and transition E2E   | U1, Auth A3–A4; `src/modules/users/repositories/`, `src/modules/users/services/`, `test/modules/users/create-user.e2e-suite.ts`, `test/modules/users/users.e2e-suite.ts`, `test/main.e2e-spec.ts`                                                                                     | RED real HTTP test for owner deletion removing sessions, old JWT rejected on a request begun after commit, rollback preserving both user and sessions on failure, forbidden other-owner deletion and 404 missing target. GREEN use Users-owned deletion plus database FK cascade in the same database transaction; Users never calls Auth. Replace historical public-create E2E fixture with HTTP Auth sign-up; preserve original CRUD coverage where still applicable and explicitly retire obsolete assertions. |
| U5 — publication and documentation | U3–U4 and Auth A5; `src/modules/users/controllers/users.controller.ts`, `src/modules/users/contracts/`, `test/modules/users/`, `docs/api/`, `docs/testing/`, `docs/configuration/` only where verified behavior changes                                                               | RED OpenAPI/document assertions for route removal, stable IDs, principal security and viewer-dependent responses. GREEN document canonical Zod input/output schemas, errors and owner-specific variants without duplicate Swagger DTOs; validate generated document and real HTTP projection.                                                                                                                                                                                                                     |

<!-- markdownlint-enable MD013 -->

Capture the smallest observed failing behavior test before implementation of each testable unit, then its passing
result; triangulate old/other/missing principals, malformed fields, pagination and read-all projection, then refactor
while focused tests remain green. Migration rewrite and passive docs have no meaningful standalone RED: verify
regenerated SQL/schema and isolated real-database effects instead. This plan claims no test lifecycle evidence.

## Users HTTP contract after transition

<!-- markdownlint-disable MD013 -->

| Operation                                                  | Required behavior                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/users`                                       | Removed; Auth sign-up is the only creation route. No User body/Location on Auth registration (see Auth PDR).                                                                                                                                                 |
| `GET /api/v1/users/me` and `GET /api/v1/users/:userId`     | Authenticated `200`; own user has exactly `id`, `email`, `displayName`, `createdAt`, `updatedAt`, `role`; another user's representation omits `email`. Persisted role is always `user`, not a JWT claim.                                                     |
| `GET /api/v1/users` and `QUERY /api/v1/users`              | Authenticated read-all, unchanged page shape, exact normalized email filter, sorting, v1 cursor behavior and strict structured QUERY body. Each item is projected for the viewer: email only for their own item; accepted email-existence inference remains. |
| `PATCH /api/v1/users/me` and `PATCH /api/v1/users/:userId` | Owner-only strict required `{ displayName }`, normalize/validate existing 2–30 Unicode-letter-and-internal-space rule. Return `200` six-field own profile. Reject empty/extra, email, password and role fields with `400 BAD_REQUEST`.                       |
| `DELETE /api/v1/users/:userId`                             | Owner-only physical deletion, `204` no body; cascade sessions atomically and reject old access tokens on subsequent requests. No `/users/me` DELETE required.                                                                                                |

Missing/invalid Bearer returns `401 UNAUTHORIZED` before resource lookup; existing other-user write returns
`403 FORBIDDEN`; nonexistent/already deleted user returns `404 RESOURCE_NOT_FOUND`. Keep `X-Request-Id` and exact shared
error catalog. Email is immutable after registration. No roles other than persisted `user`, admin creation or production
seeds. Avoid documenting historical five-field response as a current success shape. OpenAPI must not promise a single
six-field list-item schema if it would expose another user's email: represent the owner/other variants with canonical
response schemas and test output projection, including QUERY. The public contract belongs here; Auth plan intentionally
links to it.

<!-- markdownlint-enable MD013 -->

## Atomicity, release and verification

Deletion can satisfy the PDR without a reverse module dependency if the **actual** Prisma relation and generated initial
SQL enforce `ON DELETE CASCADE` from `sessions.user_id` to `users.id`. Verify provider behavior and real migrated
database before relying on it. A User delete commits with all sessions removed or rolls back both; guard performs a live
session/user check, so JWTs from before commit fail afterward. Password change is a separate cross-owner operation:
design a shared transaction-context abstraction in database infrastructure and pass it through narrow Users/Auth APIs so
credential update and all-session revocation share one transaction, with no ORM in either application service. Prove
failed changes leave both password and sessions intact. Auth owns coordination, not Users session persistence.

Run focused Users schema/service/repository tests first (for example `pnpm exec vitest run src/modules/users`), then
schema validation and generation with the configured Prisma CLI, `pnpm run test:e2e`, `pnpm test`, `pnpm lint`,
`pnpm build`, affected Markdown Prettier and lint. Verify commands and local environment before runtime execution. The
existing E2E owner creates one isolated PostgreSQL 16 database per scenario, deploys committed migrations, constructs
the real application and closes/cleans it. Register suites explicitly in `test/main.e2e-spec.ts`; create users via HTTP
Auth sign-up and authenticate through real Bearer credentials. Do not replace repository, guards, or DB with mocks in
E2E. Cover old list/QUERY cursors, read-all redaction across pages, own `/me`, strict updates, 401/403/404 ordering,
physical deletion/cascade and OpenAPI; test normalized email conflict independently of auth failure messaging.

Ship U1–U5 only with Auth A1–A5 and both PDRs' future acceptance verified: otherwise temporary public Users management
or hash leakage can persist. **Both plans required human approval before runtime work; that approval is now recorded.**
Do not mark historical checked PDR criteria as unimplemented or mark future criteria complete without observed evidence.

## Risks and rollback

- Editing an already applied initial migration would create drift on a non-disposable database. Current accounts are
  disposable in this pre-stable phase; stop and seek a new migration strategy if that premise no longer holds. Never run
  a destructive reset against retained data.
- A missing or misdirected FK cascade could leave valid sessions after deletion; inspect generated SQL and prove the
  effect with the real provider and guard.
- Passing full Users records to Auth or serializing them without explicit projections could expose password
  hashes/email; test negative fields for single, list and QUERY results.
- Adding a Users import of Auth creates a cycle. Share a neutral principal contract and transaction context, not an Auth
  session repository through Users.
- Reusing legacy public-create E2E fixtures after removing the route causes false failures; replace setup via HTTP Auth
  sign-up while preserving applicable historical assertions.
- Argon2 and Prisma transaction API details are not verified by this plan; validate installed versions and versioned
  official documentation before implementation.

Rollback Auth and Users as a single coordinated change on disposable databases, restoring the original sole migration,
original route behavior and test expectations together. Never roll back only the guard while leaving credential-bearing
Users data publicly accessible.

## Approval boundary

**Approved by the user together with the linked Auth plan.** The requirement for plan approval before runtime work is
satisfied. Verify the disposable-data assumption and the technical checks above before source work; approval does not
waive them. This documentation update does not edit runtime, PDRs or task tracking.
