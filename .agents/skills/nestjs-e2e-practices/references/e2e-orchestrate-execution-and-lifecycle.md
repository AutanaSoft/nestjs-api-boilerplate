---
title: Orchestrate E2E execution and lifecycle explicitly
impact: CRITICAL
impactDescription: Prevents duplicate suites, order-dependent state, and competing lifecycle owners
tags: nestjs, e2e, orchestration, lifecycle
---

## Orchestrate E2E execution and lifecycle explicitly

**Impact: CRITICAL (prevents duplicate suites, order-dependent state, and competing lifecycle
owners)**

### Rule

Use one main E2E orchestrator as the only runner-discovered file when suites share an application
lifecycle, mutable infrastructure, database state, or an intentionally ordered business flow. It
owns the application, temporary database, global environment, registration order, and final
teardown. It registers feature orchestrators, which register focused endpoint or business-flow
suites.

An isolated suite may instead be its own runner-discovered lifecycle owner when it creates, uses,
and disposes an independent application and infrastructure scope. It must not import or be imported
as a second discovered owner, share mutable context with another suite, or rely on execution order.
In either layout, configure discovery so an imported suite cannot also run directly.

For Jest, define a dedicated E2E project whose `testMatch` or `testRegex` discovers only the main
orchestrator for shared execution, or only the intentionally isolated owners. Place imported
orchestrators and suites under names or paths outside that pattern. Jest executes tests in one
discovered file serially in encounter order unless concurrent APIs are used; do not use
`test.concurrent` for a business flow sharing mutable context.

Default to independent endpoint tests: each establishes its own prerequisites and does not consume
state produced by a preceding test. Model an intentional sequential business flow explicitly with a
typed context owned by its feature orchestrator; register its steps in order and clean up its scoped
resources. Do not turn worker serialization into hidden flow coordination.

Treat `maxWorkers: 1` or `--runInBand` as protection for shared infrastructure, not as the ordering
mechanism. Do not use a custom `testSequencer` to compensate for duplicate discovery or unclear
ownership. `globalSetup` cannot expose its variables to test suites, so create and close the Nest
application inside the applicable lifecycle owner's test process. Reserve `setupFilesAfterEnv` for
matchers and hygiene hooks. Keep `forceExit` disabled and repair leaked handles instead.

### Why it matters

- Default Jest patterns discover `.spec` and `.test` files, including files an orchestrator imports.
- Explicit registration makes shared-flow order and ownership reviewable without relying on
  filenames.
- One lifecycle owner per shared scope prevents premature close, duplicate migrations, and competing
  cleanup.
- Typed feature contexts make deliberate flow dependencies visible instead of hiding them in
  globals.
- Independent endpoint tests remain safe to reorder; sequential business flows are visibly
  exceptional.
- A worker limit cannot prevent duplicate execution caused by an incorrect discovery pattern.

### Exceptions and limits

- Adapt suffixes and paths to the runner configuration actually used by the project.
- An isolated runner-discovered suite is valid only when its lifecycle and mutable infrastructure
  are genuinely independent; otherwise use the main orchestrator.
- Prefer independent endpoint tests. Share state only when the created resource is intentionally
  part of one ordered business flow, and expose that state through a typed feature context.
- `detectOpenHandles` is diagnostic and may be enabled only in CI or troubleshooting if its runtime
  cost is material.
- `globalSetup` may create an external resource that is addressed through serialized configuration,
  but it must not own the in-process Nest application used by the suites.
- If the test harness already owns global close, the main orchestrator must not close the same
  resource a second time.

### Recommended structure

Use this structure as the default model when the project does not already have an equivalent E2E
layout:

```text
jest.config.e2e.ts                         # Discovers only the main orchestrator
test/
├── main.e2e-spec.ts                       # Global setup, registration order, and teardown
├── support/
│   ├── e2e-environment.ts                # Database, migrations, environment, and disposal
│   ├── real-e2e-application.ts           # Production-derived NestJS bootstrap
│   ├── external-boundary-overrides.ts    # Explicit out-of-process adapter replacements
│   └── e2e-assertions.ts                 # Focused public-contract helpers
├── fixtures/
│   ├── auth.fixture.ts                   # Fresh canonical auth data factories
│   └── users.fixture.ts                  # Fresh canonical user data factories
└── modules/
    ├── auth/
    │   ├── auth.e2e-orchestrator.ts      # Auth context, suite order, and feature cleanup
    │   ├── auth.e2e-context.ts
    │   └── suites/
    │       ├── sign-up.e2e-suite.ts
    │       ├── sign-in.e2e-suite.ts
    │       └── reset-password.e2e-suite.ts
    ├── users/
    │   ├── users.e2e-orchestrator.ts     # Users context, suite order, and feature cleanup
    │   ├── users.e2e-context.ts
    │   └── suites/
    │       ├── create-user.e2e-suite.ts
    │       ├── list-users.e2e-suite.ts
    │       └── update-user.e2e-suite.ts
    └── health/
        ├── health.e2e-orchestrator.ts
        └── suites/
            ├── live-health.e2e-suite.ts
            └── ready-health.e2e-suite.ts
```

Adapt folder names and suffixes to the target repository, but preserve the ownership boundaries:

- Jest discovers only `main.e2e-spec.ts` or its local equivalent.
- The main orchestrator imports feature orchestrators.
- Each feature orchestrator imports its endpoint suites and any intentionally sequential
  business-flow suites.
- Endpoint suites establish independent prerequisites; business-flow suites consume only their typed
  feature context in their explicit registration order.
- `support/` owns shared runtime capabilities, not feature assertions.
- `fixtures/` exports fresh canonical factories and does not own mutable suite state.
- Imported orchestrators, contexts, and suites remain outside direct runner discovery.

For a genuinely small API, feature orchestrators may contain their endpoint cases directly. Keep the
main orchestrator and single-entry discovery; do not flatten lifecycle ownership merely to reduce
file count.

### Examples

**Incorrect (discovers multiple owners and hides a business flow in test order):**

```typescript
const config: Config = {
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
  maxWorkers: 1,
  forceExit: true,
};

// test/users.e2e-spec.ts imports a file Jest also discovers independently.
import './users-create.spec';

// This endpoint test silently depends on state created by another test.
it('updates the user created above', async () => {
  /* ... */
});
```

**Correct (discovers one shared lifecycle owner and imports non-discovered suites):**

```typescript
import type { Config } from 'jest';

const config: Config = {
  displayName: 'e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/main.e2e-spec.ts'],
  maxWorkers: 1,
  detectOpenHandles: true,
  forceExit: false,
};

export default config;
```

```typescript
describe('API E2E', () => {
  let environment: E2EEnvironment;

  beforeAll(async () => {
    environment = await createE2EEnvironment();
  });

  registerAuthE2E(() => environment);
  registerUsersE2E(() => environment);
  registerSettingsE2E(() => environment);
  registerCheckoutBusinessFlowE2E(() => environment);

  afterAll(async () => {
    await environment.dispose();
  });
});
```

`registerCheckoutBusinessFlowE2E` should own a typed context such as `{ customerId, orderId }` and
register its create, pay, and confirm steps in that order. `registerUsersE2E` endpoint cases should
instead create their own prerequisites and remain reorderable.

Use project-specific transforms, aliases, `rootDir`, and commands. Imported files can use a suffix
such as `*.e2e-suite.ts` only after confirming the runner excludes it. A separately discovered,
fully isolated suite may own its own environment and teardown; never use that exception to split one
shared database or application lifecycle across owners.

### Related cards

- [Run the real application and isolated infrastructure](./e2e-run-real-application-and-infrastructure.md)
- [Build realistic E2E data and assert public contracts](./e2e-build-data-and-assert-contracts.md)

Reference: [Jest configuration](https://jestjs.io/docs/configuration),
[Jest setup and teardown](https://jestjs.io/docs/setup-teardown),
[Jest CLI options](https://jestjs.io/docs/cli), and
[NestJS testing](https://docs.nestjs.com/fundamentals/testing).
