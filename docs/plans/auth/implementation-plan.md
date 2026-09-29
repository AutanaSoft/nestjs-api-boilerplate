# Auth implementation plan — approved

This approved implementation sequence follows the [Auth PDR](../../prd/auth/authentication/authentication-pdr.md). Plan
approval is recorded; this documentation update does not change runtime code. Implement jointly with the
[Users plan](../users/implementation-plan.md); neither feature may ship with public legacy Users creation or
unauthenticated Users routes. The Users PDR alone owns Users HTTP behavior and viewer projection; this plan references
that boundary rather than restating it.

## Baseline and ownership

`AppModule` currently exposes `UsersModule` and a global throttler; `UsersController` still exposes public creation. The
sole initial migration currently creates only `users` without credentials or sessions. `UsersModule` does not export a
credential API. Do not assume `@nestjs/jwt` or `argon2` is installed: `package.json` does not list them. Consult
[authentication](../../architecture/authentication.md), [authorization](../../architecture/authorization.md),
[data access](../../architecture/data-access.md), [HTTP contracts](../../api/http-contracts.md),
[OpenAPI](../../api/openapi.md), [configuration](../../architecture/configuration.md), and
[E2E conventions](../../testing/e2e-testing.md).

Auth owns session persistence, token issuance, authentication and orchestration; Users owns user persistence, password
hashes, hashing, verification and credential change. Only Auth imports Users and consumes its exported, narrow API; Auth
never imports the Users repository. Put a neutral `AuthenticatedPrincipal` contract and request accessor at a common
boundary, not inside Auth imported by Users. The guard checks JWT validity, live session and minimal current safe Users
projection; authorization uses current persisted state, never role claims. Services do not inject Prisma or HTTP
exceptions. Avoid Passport.

## Coordinated work units

<!-- markdownlint-disable MD013 -->

| Unit                                 | Dependency and likely paths                                                                                                                                                                                                                                                                                      | RED → GREEN and alternate protection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 — contract and storage            | After Users U1; `src/database/prisma/models/session.prisma`, `src/database/prisma/models/user.prisma`, `src/database/prisma/migrations/20260918000000_initial/migration.sql`, `src/modules/auth/repositories/{sessions.repository,prisma-sessions.repository}.ts`, `src/database/` transaction adapter as needed | RED repository tests for create, lookup, conditional rotation, revoked and expired sessions. GREEN add session FK to User and history of secure refresh-token digests; test a real PostgreSQL cascade and transaction rollback. Coordinate the **single** in-place initial-migration rewrite with U1, never add a second migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| A2 — configuration and tokens        | A1 and Users U2; `src/modules/auth/config/`, `src/config/` registration, `src/modules/auth/{auth.module,auth.service}.ts`, `src/modules/auth/contracts/`, `package.json`, `pnpm-lock.yaml`                                                                                                                       | RED tests for default/configured access 15m and refresh 7d lifetimes, invalid settings, strict sign-up/sign-in/refresh/change-password input and four-field output. GREEN add verified `@nestjs/jwt` integration and `node:crypto` opaque refresh generation; Users API performs all Argon2id work. Verify installed library signatures and official versioned docs before coding; no API assumptions here.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A3 — rotation and credential changes | A1–A2 and Users U2; `src/modules/auth/repositories/`, `src/modules/auth/auth.service.ts`, shared transaction-context abstraction in `src/database/` and Users credential API                                                                                                                                     | RED sequential reuse, simultaneous refresh race, unknown/expired/revoked/sessionless equivalence, two-session isolation and password-change rollback. GREEN use a transaction with conditional current-digest compare-and-swap; retain prior digests securely to identify reused tokens and revoke **only** their session. Race loser must revoke even if winner has already rotated; serialize/lock per session or otherwise prove commit ordering. Unknown digests cannot identify a session and must not revoke others. Store no reusable plaintext tokens. Password change verifies current password, rejects reuse, persists new hash and revokes **all** that user's sessions in one shared transaction context; no Prisma in application services. Concurrent change/refresh must not yield a usable post-change session. |
| A4 — HTTP and protection             | A2–A3; `src/modules/auth/{auth.controller,auth.module}.ts`, `src/modules/auth/guards/`, `src/modules/auth/decorators/`, `src/common/` principal boundary, `src/app.module.ts`, `src/config/rate-limit.config.ts` if needed                                                                                       | RED real-boundary tests for public sign-up/sign-in/refresh, protected sign-out/change-password and denial before handler. GREEN global authentication guard with explicit public metadata, live session/user lookup and proper catalog errors. Sign-out revokes only its session. Add independent per-IP 10/min sign-up and sign-in throttles **in addition to** global 100/60s default, not a replacement; verify throttler behavior for multiple named limits and proxy/IP configuration against installed version. No per-email lockout.                                                                                                                                                                                                                                                                                      |
| A5 — publication                     | A4 and Users U3–U4; `src/modules/auth/contracts/`, `src/modules/auth/auth.controller.ts`, `src/common/openapi/` only if necessary, `test/modules/auth/auth.e2e-suite.ts`, `test/main.e2e-spec.ts`, relevant `docs/api/`, `docs/configuration/`, `docs/testing/` owners                                           | RED HTTP tests for strict bodies, absent/wrong-password identical error, duplicate email, expiry fields, rotation/replay/concurrent race, logout isolation, change-password failures and successful revocation. GREEN expose exact PDR Auth operations, Zod output projection, stable OpenAPI IDs and canonical input/output/error schemas. Exercise real HTTP plus isolated PostgreSQL and versioned migration via the existing `runScenario` owner; do not mock internal Users, Auth or Prisma.                                                                                                                                                                                                                                                                                                                                |

<!-- markdownlint-enable MD013 -->

RED/GREEN applies to behavior-level deterministic tests, captured **before** each implementation slice. Triangulate
malformed/extra fields, wrong principal, expired credentials, replay across sessions, duplicate emails and concurrent
requests; refactor only with focused tests green. Schema regeneration and documentation have no meaningful standalone
behavior RED: validate schema against an isolated migrated database and inspect generated OpenAPI instead. Do not claim
any RED/GREEN observed by this plan.

## Transaction and replay design to validate

Use cryptographically random opaque refresh secrets and keyed or collision-resistant secure digests with an explicit
threat-model choice before implementation; persist current and historical digest records with expiry/session binding,
never plaintext. A unique digest index locates a retired token's session. On a valid current token, atomically replace
its digest and record the retired digest; on reuse, revoke the bound session including access tokens. Make the loser of
a same-token concurrent refresh revoke the winner's session rather than return a usable renewal. Bound history retention
to token lifetime plus the documented replay window without losing detection of still-valid rotated credentials. Confirm
PostgreSQL isolation/locking and Prisma transaction behavior against installed versions before selecting concrete APIs.
Reject every invalid refresh variant with the same catalog message and no details.

A session ID in a signed access JWT permits immediate guard revocation checks, but signing alone is insufficient. Guard
must validate signature, expiration and issuer/audience as configured, check active session and obtain current minimal
user state. No password hashes or refresh digests in tokens, responses or logs. Any authorization projection uses the
persisted role. During registration, avoid an orphan user if session creation fails: shared transaction context or
compensating rollback must be proven with a failure test; prefer a single transaction participating through feature
APIs.

## Verification and release gate

For later authorized implementation, run focused unit/repository tests first (for example
`pnpm exec vitest run src/modules/auth src/modules/users`), then `pnpm prisma:generate`, Prisma schema validation with
the project's configured CLI, `pnpm run test:e2e`, `pnpm test`, `pnpm lint`, `pnpm build`, and affected Markdown
Prettier then lint. Confirm actual script availability and environment before execution; E2E requires the documented
loopback PostgreSQL admin URL and must not touch a shared database. Check real HTTP headers, `X-Request-Id`, token
response shape, OpenAPI security/operation metadata and status/error catalog. Extend `test/main.e2e-spec.ts` explicitly;
each scenario gets isolated migrated DB and real credentials obtained over HTTP. Only external out-of-process adapters,
if later introduced, may be substituted.

Do not release A1–A5 separately from Users U1–U5: otherwise legacy public account creation, unprotected routes or leaked
fields remain. Gate on both PDRs' future criteria, migration consistency, all focused and full checks, and explicit
**human approval of both plans before any runtime change (now satisfied)**. Update owner documentation only alongside
verified behavior. Before any review, follow `AGENTS.md` normalization requirements; this plan update starts no review.

## Risks and rollback

- Concurrent refresh replay can escape revocation if compare-and-swap and loser revocation use separate uncoordinated
  commits; prove deterministic competing requests and inspect session state.
- Invalid or ambiguous digest history could permit replay or revoke unrelated sessions; enforce digest uniqueness,
  retention and per-session isolation tests.
- Global guard can accidentally protect sign-up/refresh or leave Users routes public; test both sides and the additive
  rate limits.
- Library-specific JWT, Argon2 and throttler APIs are **unverified**; resolve exact installed signatures, configuration
  and versioned upstream documentation before implementation.
- This pre-stable migration rewrite is safe only for disposable accounts/databases. Never apply an edited initial
  migration over a data-bearing deployment; stop and obtain a separate migration decision if that premise fails.

Rollback is a coordinated reversal of Auth and Users runtime, schema, tests and configuration on disposable
environments, restoring the original initial migration under its original name. Do not leave the application with Auth
removed but Users newly public, or credentials persisted without a working guard.

## Approval boundary

**Approved by the user together with the linked Users plan.** The requirement for approval before runtime work is
satisfied. Before source work, confirm the disposable-data premise and library API evidence; approval does not waive
those technical checks. This documentation update makes no runtime changes.
