# Testing

This document defines the general testing conventions for the NestJS API Boilerplate.

The project uses Vitest as its test runner.

## Test Scope

Tests should verify behavior at the smallest practical boundary.

Use unit tests for isolated application behavior and E2E tests for behavior that must be proven through the public HTTP
API and real application infrastructure.

Do not use E2E tests to replace focused unit tests, and do not use unit tests to claim coverage of runtime integration.

## Unit Tests

Unit tests should remain close to the code they verify.

For example:

```text
src/modules/users/
├── users.service.ts
├── users.service.spec.ts
├── users.controller.ts
└── users.controller.spec.ts
```

Tests should follow the same feature ownership as production code.

Do not create a repository-wide directory organized only by technical test type for feature-owned unit tests.

## Isolation

Unit tests should isolate the component under test from external dependencies and unrelated collaborators.

Dependencies may be replaced with controlled test doubles when the test does not intend to verify those implementations.

For example, a service unit test may replace its repository with a test double:

```text
UsersService
    ↓
Test UsersRepository
```

The test should verify the service contract and behavior rather than ORM or database implementation details.

## Test Doubles

Use test doubles only at dependencies outside the responsibility being tested.

Avoid mocking implementation details internal to the component under test.

Test doubles should expose the smallest behavior required by the scenario and should not reproduce the complete
implementation of the real dependency.

## Assertions

Prefer assertions against observable results and contracts.

Examples include:

- returned values;
- thrown errors;
- state transitions owned by the component;
- calls to an external dependency when that interaction is part of the component contract.

Avoid assertions that unnecessarily couple tests to private implementation details.

## Test Data

Tests should create fresh data for each scenario.

Avoid mutable test objects shared between cases.

Use factories or canonical builders when multiple tests require equivalent valid inputs.

Invalid test inputs should preferably be derived from a fresh valid input by modifying only the property relevant to the
scenario.

## Determinism

Tests must not depend on:

- execution order;
- data created by unrelated tests;
- production services;
- uncontrolled network access;
- shared mutable global state.

Time, randomness, and other nondeterministic dependencies should be controlled when they affect the behavior under test.

## Coverage

Coverage is a diagnostic signal, not an architectural target by itself.

Prioritize meaningful coverage of:

- business rules;
- validation behavior;
- security-sensitive behavior;
- error paths;
- module boundaries;
- persistence behavior where appropriate.

Do not add low-value tests solely to increase a coverage percentage.

## E2E Boundary

End-to-end testing has different lifecycle, infrastructure, fixture, and external-boundary requirements.

Those conventions are defined separately in `e2e-testing.md`.

## Rules

1. Use Vitest as the project test runner.
2. Keep feature-owned unit tests close to their production code.
3. Test behavior at the smallest practical boundary.
4. Isolate unrelated dependencies in unit tests.
5. Avoid testing private implementation details.
6. Use fresh and deterministic test data.
7. Do not make tests depend on execution order or shared mutable state.
8. Use test doubles only at boundaries outside the responsibility under test.
9. Prioritize meaningful behavioral coverage over coverage percentages.
10. Use E2E tests when behavior must be verified through the real application boundary.
