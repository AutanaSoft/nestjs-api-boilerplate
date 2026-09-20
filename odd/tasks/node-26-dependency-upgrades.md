# Node 26 and dependency upgrades

## Objective

Move the project runtime baseline to Node.js 26, then apply the closed Dependabot development and production dependency
updates as separate reviewable units.

## Scope

- Keep the completed Node.js 26 runtime baseline.
- Apply the eight development dependency updates from closed Dependabot PR #12.
- Apply the five production dependency updates from closed Dependabot PR #11 separately.
- Regenerate `pnpm-lock.yaml` only through the canonical package manager.

## Constraints

- Keep development and production updates separate.
- Keep NestJS packages on major version 12.
- Keep `vitest` and `@vitest/coverage-v8` on matching versions.
- Use Node.js 26 for verification.
- Do not restore deleted Dependabot branches.
- Do not commit or push without explicit user authorization.

## TDD mode

TDD is off because this is a dependency maintenance change. Verification uses focused tool checks followed by the
complete repository suite.

## Tasks

- [x] **NODE-26-1 — Move the supported runtime baseline to Node.js 26**
  - Published on `main` as `da7d04f` (`ci(runtime): move runtime baseline to Node 26`).
  - The Node 26 shutdown-process incompatibility was repaired separately as `8986e21`.
- [x] **NODE-26-2 — Apply development dependency updates from Dependabot PR #12**
  - Updated the eight requested development dependencies and regenerated `pnpm-lock.yaml` canonically.
  - Enabled Nest's `forceCloseConnections` after verification exposed a real shutdown timeout with incomplete requests.
  - Verified formatting, linting, unit tests, shutdown-process tests, E2E tests, and build.
- [ ] **NODE-26-3 — Apply production dependency updates from Dependabot PR #11**
  - Update the requested NestJS, Zod, and observability packages.
  - Regenerate the lockfile and verify the complete project suite.

## Acceptance criteria

- Node.js 26 remains the declared and tested runtime baseline.
- Development dependencies match the exact PR #12 target versions.
- Production dependencies are not changed during NODE-26-2.
- Lockfile changes are generated with the repository's canonical pnpm version.
- All configured quality checks pass, or any blocker is reported with evidence.

## Progress

- NODE-26-1 is complete and published on `main`.
- NODE-26-2 is implemented and verified on `chore/node-26-dependency-upgrades`.
- The shutdown failure was confirmed as a production defect: an active incomplete request prevented Nest's HTTP server
  from closing before the watchdog deadline. `forceCloseConnections` now makes this lifecycle deterministic.
- NODE-26-3 remains pending.

## Verification evidence

- Node.js v26.9.0 and pnpm 12.4.2 were used.
- Lockfile-only normal and frozen installs passed.
- Frozen lockfile verification passed without repository mutation.
- Formatting, TypeScript/JavaScript lint, Markdown lint (309 files), 354 unit tests, 3 shutdown-process tests, 59 E2E
  tests, build, and diff checks passed.
- Production dependency versions remained unchanged.
- The shutdown regression was reproduced with timeout diagnostics before the fix. The focused bootstrap test followed
  RED/GREEN, the worker observed five consecutive process-suite passes, and the independent verifier passed 3/3.
- No commit or push was performed.
