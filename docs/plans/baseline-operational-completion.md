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
- [ ] OB-07 — Pending
- [ ] OB-08 — Pending
- [ ] OB-09 — Pending
- [x] OB-10 — Complete
- [x] OB-11 — Complete
- [ ] OB-12 — Pending
- [ ] OB-13 — Unresolved
- [ ] OB-14 — Deferred; outside the completion denominator

## Evidence boundary

### Verified usable implementation APIs

- `setupApplication()` configures trust proxy, optional global prefix, URI versioning, Helmet, and
  CORS (`src/app.setup.ts`).
- `HealthController` exposes versioned `GET /health/live` and `GET /health/ready`; the default
  published paths are `/api/v1/health/live` and `/api/v1/health/ready`
  (`src/modules/health/health.controller.ts`, [versioning owner](../api/versioning.md)).
- Typed Zod configuration factories registered with `registerAs` provide `app`, `api`, `http`,
  `cors`, and `rateLimit` (`src/config/`; [configuration owner](../architecture/configuration.md)).

### Documented targets, not verified usable APIs

`StandardSchemaValidationPipe` and `StandardSchemaSerializerInterceptor` are target strategy names
in the architecture documents, not verified source exports or installed runtime APIs. Likewise, the
OpenAPI owner requires `@nestjs/swagger`, but it is not present in `package.json` and no Swagger
bootstrap is verified. Do not treat those names as implementation-ready APIs.

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

| ID    | Status     | Item, evidence, dependencies, and acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-07 | Pending    | **Swagger/OpenAPI (required).** Evidence: [OpenAPI owner](../api/openapi.md) declares `@nestjs/swagger` and stable unique `operationId` requirements; no package or bootstrap exists. Dependencies: OB-03 and canonical request/response/error contracts. Acceptance: generate OpenAPI from canonical schemas/contracts; include every published versioned route; preserve stable unique operation IDs; represent shared errors; add contract checks. **Unresolved implementation decisions:** production exposure policy, documentation/spec routes, metadata source and values, and how generator metadata stays aligned with canonical Zod contracts. Do not choose these here.                                                                                                                                                                                                                                                                                        |
| OB-08 | Pending    | **Request validation.** Evidence: the architecture names `StandardSchemaValidationPipe` as the target; no implementation is verified. Dependencies: canonical request schemas and OB-10 error translation. Acceptance: validate and normalize external input before controllers/services receive it, using canonical schemas; translate validation failures to the shared public error contract. Owner: [validation](../architecture/validation.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| OB-09 | Pending    | **Response serialization.** Evidence: the architecture names `StandardSchemaSerializerInterceptor` as the target; no implementation is verified. Dependencies: canonical response schemas and OB-10. Acceptance: validate/serialize public responses against their canonical schemas without exposing internal models. Owner: [serialization](../architecture/serialization.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| OB-10 | Complete   | **Central HTTP errors.** Evidence: commits `fa9412d`, `66583d4`, `2da106f`, `0004bb3`, and `7d780d5` implement and verify application/framework mappings, the correlated global boundary, its module registration, and the versioned unmatched-route controller; the final local verification passed Prettier check, `pnpm lint`, Markdown lint (295 files, 0 issues), unit tests (19 suites, 121 tests), E2E (1 suite, 22 tests), and build (TSC 0 issues; SWC 23 files). Dependencies: OB-11 supplies `requestId` correlation data. Acceptance: the one boundary translates validation, expected, unknown, and unmatched-route errors into safe documented responses without technical or sensitive details; specific routes take priority over the versioned catch-all, and unmatched routes reach the boundary as `NotFoundException` for `ROUTE_NOT_FOUND`. Owners: [error handling](../architecture/error-handling.md), [HTTP contracts](../api/http-contracts.md). |
| OB-11 | Complete   | **Request correlation and structured logs.** Evidence: `ObservabilityModule`, `RequestContextService`, correlation and terminal logging middleware, and `StructuredLoggerService` provide safe correlated events through shared production/E2E bootstrap. `X-Request-Id` is allowed and exposed by CORS; tests cover generated/adopted/replaced IDs, concurrency, `200`, `404`, `429`, preflight, duration, route labels, and metadata exclusion. Dependencies: none; OB-10 consumes its correlation data. Acceptance: every request receives or safely adopts one correlation ID, logs stable structured events with it, and returns it only where the public contract requires it. Owner: [observability](../architecture/observability.md).                                                                                                                                                                                                                            |
| OB-12 | Pending    | **Graceful shutdown.** Evidence: `src/main.ts` creates and listens but no shutdown handling is verified. Dependencies: health semantics and future resource owners. Acceptance: termination stops accepting work, closes Nest/resources within a bounded policy, and exits with an observable outcome; add focused tests where practical.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OB-13 | Unresolved | **Reproducible pnpm version.** Evidence: README states pnpm `11.25.0`, but `package.json` has no `packageManager`; historical local pnpm was `12.4.1`. Dependencies: package-manager policy and CI/Corepack. Acceptance: record one canonical pnpm version in the repository mechanism selected by maintainers, align README and CI/Corepack behavior, and verify frozen installation. **Open decision:** canonical pnpm version and declaration mechanism. Do not choose either in this checklist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Explicitly deferred

| ID    | Status   | Item, evidence, dependencies, and acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-14 | Deferred | **Metrics and traces.** Evidence: the observability owner approves OpenTelemetry for metrics and tracing, but no implementation is verified. Dependencies: operational backend and instrumentation design. Acceptance to remove this deferral: define stable low-cardinality metrics and trace propagation/instrumentation, then verify them. This does not mark full observability complete. Owner: [observability](../architecture/observability.md). |

## Final baseline completion criteria

The baseline is ready **before starting business module development** only when:

- [ ] Every item from OB-01 through OB-13 is Complete and has current implementation evidence.
- [ ] All unresolved implementation decisions, including Swagger/OpenAPI exposure/routes/metadata
      and the canonical pnpm version/declaration, are resolved and reflected in the relevant owners.
- [ ] The required focused and repository quality checks are rerun successfully after the final
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
