# OB-12 Graceful Shutdown

## Objective

Implement the approved OB-12 plan so the running NestJS process handles `SIGTERM` and `SIGINT` with bounded, observable,
and deterministic shutdown behavior.

## Problem and rationale

The application currently listens for HTTP traffic but has no verified process-signal shutdown boundary. Deployments
therefore lack a bounded policy for closing the listener and Nest-owned resources. The implementation must preserve
POSIX signal semantics on success and force a safe, observable exit on timeout or close failure.

## Scope

- Add a typed `shutdown` configuration namespace with a 10-second default deadline.
- Add lifecycle logger contracts and a synchronous emergency sink with closed metadata.
- Add one shutdown coordinator for `SIGTERM` and `SIGINT`, installed only after successful listen.
- Preserve startup errors while cleaning up a partially created application.
- Add unit tests and an isolated compiled child-process test target.
- Update CI, owner documentation, and both operational baselines after verification.

## Constraints and non-goals

- Follow `docs/plans/shutdown/graceful-shutdown.md` and strict TDD.
- Do not change health readiness semantics or add draining state.
- Do not use `enableShutdownHooks()`, `useProcessExit`, or `process.exit(0)`.
- `app.close(signal)` remains the sole Nest lifecycle orchestrator.
- Do not add domain resources or providers solely to block shutdown tests.
- Preserve the existing user change in `pnpm-workspace.yaml`; it is outside scope.
- Do not commit or push.
- Target roughly 400 authored changed lines per coherent task as an advisory planning heuristic, never at the expense of
  tests or correctness.

## TDD mode

- Mode: enabled.
- Source: approved OB-12 implementation plan.
- Runner: Vitest through focused `pnpm exec vitest run ...`, plus the isolated `pnpm run test:shutdown-process` target.

## Tasks

- [x] **OB12-1 — Configuration and lifecycle event contracts**
  - RED observed for missing shutdown configuration and emergency sink contracts.
  - Implemented typed configuration and closed lifecycle metadata.
  - Focused configuration/logger tests pass.
- [x] **OB12-2 — Shutdown coordinator and bootstrap boundary**
  - RED observed for the missing coordinator and exported bootstrap boundary.
  - Implemented first-signal-wins coordination, terminal latch, timeout/failure handling, post-listen installation, and
    startup cleanup aggregation.
  - Focused coordinator/bootstrap tests pass for both signals, repetition, timeout, late resolution, rejection, and
    startup cleanup.
- [x] **OB12-3 — Compiled process integration and CI**
  - Added an isolated build-first POSIX child-process suite outside normal unit-test discovery.
  - Verified `SIGTERM`, `SIGINT`, listener closure, preserved signal exit, and incomplete-request graceful closure
    without fixed sleeps.
  - Retained watchdog timeout proof at the coordinator unit seam because Node 26 closes the real incomplete HTTP
    connection; the user approved this evidence correction rather than introducing an artificial production blocker.
  - Added the mandatory process target to Ubuntu CI.
- [x] **OB12-4 — Owner documentation and baseline closure**
  - Added the process lifecycle configuration owner and updated concise configuration, observability, and testing
    cross-references.
  - Corrected the plan to distinguish compiled-process signal/listener evidence from deterministic coordinator timeout
    evidence.
  - Marked OB-12 complete in both baselines after implementation checks were green.
- [x] **OB12-5 — Final verification and review readiness**
  - Ran lint-staged twice without candidate mutations, process tests, unit tests, E2E, lint, build, format check,
    Markdown lint, and diff checks.
  - Independent verification found no candidate issues.
  - Native review `review-05b7810c085d077b` was approved and acknowledged; its four advisory findings are non-blocking
    follow-up candidates.

## Acceptance criteria

- Only `SIGTERM` and `SIGINT` initiate runtime shutdown after successful listen.
- First signal wins; repeated signals do not duplicate close, timer, events, or alter the winning signal.
- Success removes listeners, emits started/completed events, and re-emits the original signal.
- Timeout and close rejection each emit exactly one synchronous safe critical event and exit with code 1.
- Late close completion cannot emit success or re-signal after a terminal failure.
- `SHUTDOWN_TIMEOUT_MS` is typed, readonly, validated, and defaults to `10000`.
- Startup cleanup preserves the original error or produces an aggregate if cleanup also fails.
- The isolated process suite runs the compiled real application and is mandatory on supported POSIX CI.
- Readiness draining remains explicitly deferred.
- Watchdog timeout is proven deterministically at the coordinator unit boundary; the compiled process suite proves both
  POSIX signals, listener closure, and real incomplete-request behavior without an artificial production blocker.
- All required checks pass before the baselines mark OB-12 complete.

## Verification evidence

- Focused Vitest: 20 tests passed across configuration, logger, coordinator, and bootstrap suites.
- Focused Prettier check passed.
- `pnpm lint` passed.
- `pnpm build` passed.
- Parent structural readback confirmed the coordinator terminal latch and post-listen installation; `git diff --check`
  passed.
- Isolated compiled process suite: 3 tests passed for `SIGTERM`, `SIGINT`, and incomplete JSON request closure.
- Full unit suite: 29 files and 208 tests passed.
- OB12-3 focused Prettier check, `pnpm lint`, and `pnpm build` passed.
- Runtime investigation showed Node 26 closes the incomplete HTTP connection during server shutdown; the user approved
  retaining timeout proof in the deterministic coordinator unit test instead of adding an artificial production blocker.
- OB12-4 Prettier write, Markdown lint (0 issues), and `git diff --check` passed.
- Final checks passed: process 3 tests; unit 208 tests; E2E 33 tests; lint; build; full Prettier; Markdown lint 301
  files with 0 issues; staged diff check.
- Independent verification reported no findings.
- Native high-risk review `review-05b7810c085d077b` was approved and acknowledged. Non-blocking advisories concerned
  failure-event naming, a process-test helper name, logger-throw resilience, and signal re-emission fallback.
- The pre-existing `pnpm-workspace.yaml` change was isolated from review and restored byte-for-byte afterward.

## Progress and next step

OB12-1 through OB12-5 are complete. The OB-12 candidate is staged, verified, and review-approved. No commit or push was
performed; the pre-existing `pnpm-workspace.yaml` change and the untracked ODD continuity file remain outside the
candidate.
