# Operational baseline completion checklist

This checklist records the operational work that must be complete before business module development
begins. It is a tracking aid, not an architecture owner: follow the linked owner documents for rules
and contracts. Swagger/OpenAPI is required before business module development begins.

Spanish version: [Lista de verificación en español](baseline-operational-completion.es.md).

## Scope and status

**Included:** the HTTP operational baseline and its verification. **Excluded:** database,
authentication, authorization, and business modules. Metrics and traces are deliberately deferred;
this baseline is **not** full observability.

| Status     | Meaning                                                        |
| ---------- | -------------------------------------------------------------- |
| Complete   | Verified implementation and evidence exist.                    |
| Pending    | Must be implemented before business module development begins. |
| Unresolved | A required implementation decision remains open.               |
| Deferred   | Intentionally outside the baseline completion denominator.     |

### Task status summary

**Completion denominator: OB-01 through OB-13.** OB-14 is explicitly deferred and does not count
toward baseline readiness.

- [x] OB-01 — Complete
- [x] OB-02 — Complete
- [x] OB-03 — Complete
- [x] OB-04 — Complete
- [x] OB-05 — Complete
- [x] OB-06 — Complete
- [x] OB-07 — Complete
- [x] OB-08 — Complete
- [x] OB-09 — Complete
- [x] OB-10 — Complete
- [x] OB-11 — Complete
- [x] OB-12 — Complete
- [x] OB-13 — Complete
- [ ] OB-14 — Deferred; outside the completion denominator

## Evidence boundary

### Verified usable implementation APIs

- `setupApplication()` configures trust proxy, optional global prefix, URI versioning, Helmet, and
  CORS (`src/app.setup.ts`).
- `HealthController` exposes versioned `GET /health/live` and `GET /health/ready`; the default
  published paths are `/api/v1/health/live` and `/api/v1/health/ready`
  (`src/modules/health/health.controller.ts`, [versioning owner](../api/versioning.md)).
- Typed Zod configuration factories registered with `registerAs` provide `app`, `api`, `http`,
  `cors`, `rateLimit`, `openapi`, and `shutdown` (`src/config/`;
  [configuration owner](../architecture/configuration.md)).
- `SerializationModule` registers one global `APP_INTERCEPTOR` that validates and transforms only
  explicitly declared schemas; the canonical health response schema owns `live` and `ready`
  (`src/common/serialization/`, `src/modules/health/contracts/`;
  [serialization owner](../architecture/serialization.md)).
- OpenAPI is disabled by default and, when enabled, exposes only unversioned configured UI and JSON
  routes from `app` metadata; `HealthModule` supplies the only published operations, with canonical
  Zod health/error schemas, stable IDs, and `200`, `500`, `503` responses (`src/common/openapi/`,
  `src/modules/health/health.controller.ts`; [OpenAPI owner](../api/openapi.md)).
- `ValidationModule` registers one global `APP_PIPE` with `StandardSchemaValidationPipe`; parameters
  with `metadata.schema` receive transformed schema output, and invalid input reaches the existing
  safe error boundary (`src/common/validation/`, `src/app.module.ts`;
  [validation owner](../architecture/validation.md)).

## Completion checklist

### Implemented baseline

| ID    | Status   | Item, evidence, dependencies, and acceptance criteria                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-01 | Complete | **Typed Zod configuration.** Evidence: `src/config/*.config.ts` validates and registers typed namespaces; `AppModule` loads them. Dependencies: none. Acceptance: configuration is validated before consumers receive typed values; invalid required values stop startup. Owner: [configuration](../architecture/configuration.md).                                                     |
| OB-02 | Complete | **HTTP security and proxy baseline.** Evidence: `setupApplication()` configures `trust proxy`, Helmet, and explicit CORS; E2E covers headers, origins, and preflight. Dependencies: OB-01. Acceptance: proxy hops, Helmet, and CORS remain configured through the shared production/E2E bootstrap. Owner: [HTTP security](../configuration/http-security.md).                           |
| OB-03 | Complete | **URI versioning.** Evidence: `API_VERSION = '1'`, `setupApplication()` enables `VersioningType.URI`, and `HealthController` declares the version. Dependencies: OB-01. Acceptance: published routes use the configured prefix plus `/v1`; unversioned and nonexistent-version health routes remain unavailable. Owner: [API versioning](../api/versioning.md).                         |
| OB-04 | Complete | **In-memory global throttling.** Evidence: `ThrottlerModule.forRootAsync()` uses `rateLimitConfig`; health is excluded and E2E verifies `200`, `200`, `429` on the E2E-only route. Dependencies: OB-01. Acceptance: limits are validated at startup and non-health routes are guarded. Limitation: counters are per process. Owner: [HTTP security](../configuration/http-security.md). |
| OB-05 | Complete | **Health checks.** Evidence: `HealthModule` and `HealthController` use Terminus; E2E asserts both versioned probes. Dependencies: OB-02, OB-03, OB-04. Acceptance: liveness and readiness return the documented basic Terminus response and do not yet check dependencies. Owner: [E2E testing](../testing/e2e-testing.md).                                                             |
| OB-06 | Complete | **Quality and CI.** Evidence: `.github/workflows/ci.yml` runs frozen install, formatting, TypeScript/Markdown lint, unit and E2E tests, and build on pull requests and `main` pushes. Dependencies: package lock and toolchain. Acceptance: CI continues to execute that sequence. Owner: [testing](../testing/testing.md).                                                             |

### Must complete before starting business module development

| ID    | Status   | Item, evidence, dependencies, and acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OB-07 | Complete | **Swagger/OpenAPI (required).** Evidence: `@nestjs/swagger@12.0.1`, the typed `openapi` namespace, conditional `setupOpenApi()`, canonical Zod schema conversion, and health transport metadata are implemented; deterministic and HTTP E2E tests cover exposure, metadata, paths, schemas, operation IDs, exclusions, routes, and headers. Dependencies: OB-03 and canonical health/error contracts. Acceptance: OpenAPI remains disabled by default; when enabled, it exposes only configured unversioned UI/JSON routes, derives metadata from `appConfig` and schemas from canonical owners, documents only published production health operations with stable unique IDs and exact `200`, `500`, `503` responses, and excludes catch-all/E2E controllers. Owners: [OpenAPI](../api/openapi.md), [configuration](../architecture/configuration.md), [E2E testing](../testing/e2e-testing.md).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| OB-08 | Complete | **Request validation.** Evidence: `ValidationModule` registers one `APP_PIPE` with `StandardSchemaValidationPipe` and `transform: true`; `AppModule` imports it once. Schema-decorated parameters use `metadata.schema`, receive transformed output, and invalid input uses a controlled `BadRequestException` without schema issues. Unit and E2E tests cover registration, transformed output, schema opt-in, safe `400 BAD_REQUEST`, and correlation; the validation fixture is structurally E2E-only. Dependencies: OB-10 error translation and the canonical schema owner for each endpoint. Acceptance: retain the one DI-registered pipe, canonical schema ownership, transformed input before controllers, and safe shared error translation. Owner: [validation](../architecture/validation.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| OB-09 | Complete | **Response serialization.** Evidence: commits `3137548`, `00cda8e`, `9f6350a`, `f6b2508`, and `df75d82` implement the canonical health schema, serializer boundary, global registration and health decorators, safe `ResponseContractViolation` translation, and E2E verification. One global `APP_INTERCEPTOR` validates and transforms explicitly declared schemas; the health Feature owns the canonical schema declared by `live` and `ready`; extra top-level fields are projected out; invalid output becomes a safe correlated `500`; and test-only fixtures remain isolated. Final checks passed: Prettier check, `pnpm lint`, Markdown lint (296 files, 0 issues), unit tests (22 suites, 154 tests), E2E (1 suite, 25 tests), and build (TSC 0 issues; SWC 27 files). Dependencies: OB-10 is Complete and supplies error translation; the canonical health response schema now exists. Acceptance: validate and serialize public responses against explicitly declared canonical schemas without exposing internal models; project out extra top-level fields; translate invalid output through the shared error boundary as a safe correlated `500`; preserve the canonical health schema declared by `live` and `ready`; and keep test-only fixtures isolated. Owner: [serialization](../architecture/serialization.md). |
| OB-10 | Complete | **Central HTTP errors.** Evidence: commits `fa9412d`, `66583d4`, `2da106f`, `0004bb3`, and `7d780d5` implement and verify application/framework mappings, the correlated global boundary, its module registration, and the versioned unmatched-route controller; the final local verification passed Prettier check, `pnpm lint`, Markdown lint (295 files, 0 issues), unit tests (19 suites, 121 tests), E2E (1 suite, 22 tests), and build (TSC 0 issues; SWC 23 files). Dependencies: OB-11 supplies `requestId` correlation data. Acceptance: the one boundary translates validation, expected, unknown, and unmatched-route errors into safe documented responses without technical or sensitive details; specific routes take priority over the versioned catch-all, and unmatched routes reach the boundary as `NotFoundException` for `ROUTE_NOT_FOUND`. Owners: [error handling](../architecture/error-handling.md), [HTTP contracts](../api/http-contracts.md).                                                                                                                                                                                                                                                                                                                                                            |
| OB-11 | Complete | **Request correlation and structured logs.** Evidence: `ObservabilityModule`, `RequestContextService`, correlation and terminal logging middleware, and `StructuredLoggerService` provide safe correlated events through shared production/E2E bootstrap. `X-Request-Id` is allowed and exposed by CORS; tests cover generated/adopted/replaced IDs, concurrency, `200`, `404`, `429`, preflight, duration, route labels, and metadata exclusion. Dependencies: none; OB-10 consumes its correlation data. Acceptance: every request receives or safely adopts one correlation ID, logs stable structured events with it, and returns it only where the public contract requires it. Owner: [observability](../architecture/observability.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| OB-12 | Complete | **Graceful shutdown.** Evidence: `ShutdownCoordinatorService` installs only after successful `listen()`, accepts only `SIGTERM`/`SIGINT`, closes once through `app.close(signal)`, and emits bounded lifecycle outcomes; `shutdown` validates `SHUTDOWN_TIMEOUT_MS` with a `10_000` ms default. The compiled POSIX suite passed for both signals, listener closure, and a real incomplete JSON request; deterministic coordinator unit tests passed for watchdog timeout, late completion, and close failure. Node 26 behavior selected this boundary: no process-level timeout exit is claimed. Dependencies: health semantics and future resource owners. Acceptance: termination stops accepting work, closes Nest/resources within a bounded policy, and exits with an observable outcome. Readiness draining remains deferred. Owner: [process lifecycle](../configuration/process-lifecycle.md).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| OB-13 | Complete | **Reproducible pnpm version.** Evidence: `package.json` declares `packageManager: pnpm@12.4.2`; README documents installing and enabling Corepack for Node 26; CI runs `pnpm/action-setup@v4` without a version input before `actions/setup-node@v7`. Observed verification: `corepack --version` returned `0.36.0`; `corepack pnpm --version` returned `12.4.2`; `corepack pnpm install` and `corepack pnpm install --frozen-lockfile` passed; Prettier, TypeScript and Markdown lint, unit tests (29 files, 208 tests), shutdown-process tests (1 file, 3 tests), E2E tests (1 file, 33 tests), build, and `git diff --check` passed. The frozen rerun retained the `pnpm-lock.yaml` hash `fd32cfb873f49f48777c7d0bad5ec8694e036da5476b8c1f5e32609a9d1fa429`. Dependencies: package-manager policy and CI/Corepack. Acceptance: the `packageManager` field remains the sole pnpm version source; CI installs pnpm from that field; frozen installation remains stable; and the documented Corepack steps work on Node 26.                                                                                                                                                                                                                                                                                                          |

### Explicitly deferred

| ID    | Status   | Item, evidence, dependencies, and acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-14 | Deferred | **Metrics and traces.** Evidence: the observability owner approves OpenTelemetry for metrics and tracing, but no implementation is verified. Dependencies: operational backend and instrumentation design. Acceptance to remove this deferral: define stable low-cardinality metrics and trace propagation/instrumentation, then verify them. This does not mark full observability complete. Owner: [observability](../architecture/observability.md). |

## Final baseline completion criteria

The baseline is ready **before starting business module development** only when:

- [x] Every item from OB-01 through OB-13 is Complete and has current implementation evidence.
- [x] All unresolved implementation decisions are resolved and reflected in the relevant owners.
- [x] The required focused and repository quality checks are rerun successfully after the final
      changes.
- [ ] OB-14 remains explicitly deferred and excluded from the completion denominator unless its
      scope is separately approved and implemented.

## Final local verification (clean working tree)

The following verification was confirmed in a clean working tree: Prettier check and `pnpm lint`
passed; Markdown lint checked 295 files with 0 issues; unit tests passed with 19 suites and 121
tests; E2E passed with 1 suite and 22 tests; build completed with TSC reporting 0 issues and SWC
processing 23 files.

## Maintenance

- Keep item IDs and statuses identical in the
  [Spanish version](baseline-operational-completion.es.md).
- Update evidence only from verified source, test, CI, or documented-owner evidence; do not convert
  targets into completed APIs without implementation evidence.
- Change an item status, its task checkbox, evidence, dependencies, and acceptance criteria in both
  translations in the same change.
- Keep OB-14 outside the completion denominator unless a separately approved scope changes it.
- Link owner documents rather than duplicating their architectural or public-contract rules.
