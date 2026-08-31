# E2E Testing

This document defines the end-to-end testing architecture for the NestJS API Boilerplate.

E2E tests verify the delivered application through its public HTTP boundary using production-like runtime behavior and
isolated real infrastructure.

## Application Boundary

E2E tests must start from the same application root and shared bootstrap behavior used by production.

Public-request behavior that affects runtime contracts must remain equivalent, including applicable:

- HTTP adapter configuration;
- global pipes;
- filters;
- interceptors;
- serialization;
- authentication;
- application configuration.

E2E-specific setup may isolate infrastructure or external providers, but it must not replace the internal application
flow being tested.

## Lifecycle Ownership

A shared E2E environment must have one explicit lifecycle owner.

The lifecycle owner is responsible for:

- application creation;
- test environment configuration;
- temporary database creation;
- migrations;
- feature-suite registration;
- application teardown;
- database teardown;
- environment restoration.

The test runner should discover only lifecycle-owner files.

Imported feature orchestrators and suites must not also be discovered and executed independently.

## Structure

A growing E2E suite may use:

```text
test/
├── main.e2e-spec.ts
├── support/
├── fixtures/
└── modules/
```

For example:

```text
test/
├── main.e2e-spec.ts
├── support/
│   ├── e2e-environment.ts
│   ├── e2e-application.ts
│   └── external-boundary-overrides.ts
├── fixtures/
│   ├── auth.fixture.ts
│   └── users.fixture.ts
└── modules/
    ├── auth/
    │   ├── auth.e2e-orchestrator.ts
    │   └── suites/
    └── users/
        ├── users.e2e-orchestrator.ts
        └── suites/
```

Directories should be introduced as the suite grows rather than as mandatory empty boilerplate.

Vitest discovery must be configured so imported orchestrators and suites are not executed independently.

## Test Independence

Independent endpoint scenarios should establish their own prerequisites and remain safe to reorder.

Tests must not silently depend on state produced by a preceding test.

An ordered business flow may intentionally share state when the sequence itself is the behavior being tested.

Shared flow state must be explicit and owned by a typed feature context rather than global mutable variables.

## Real Infrastructure

E2E tests must use real persistence.

For this project, the E2E environment should use an isolated PostgreSQL database and the production Prisma persistence
path.

The environment must:

1. create an isolated database;
2. apply committed Prisma migrations;
3. configure the application to use that database;
4. start the application;
5. execute the scenarios;
6. close application and persistence resources;
7. remove the temporary database.

E2E execution must fail closed when the configured database cannot be proven safe for testing.

Development and production databases must never be reused as E2E databases.

## Real Application Components

The following components should remain real in E2E tests:

- controllers;
- guards;
- pipes;
- interceptors;
- application services;
- repositories;
- Prisma;
- PostgreSQL;
- authentication flows.

Do not replace repositories or application services with in-memory implementations and describe the resulting scenario
as full E2E coverage.

## Authentication

Authenticated E2E scenarios should obtain credentials through the public authentication flow.

Do not use hardcoded or pre-issued access tokens when the application itself is responsible for issuing them.

This ensures authentication configuration, token issuance, guards, and user validation participate in the tested
runtime.

## Fixtures

Fixtures own fresh request data used by E2E scenarios.

Prefer canonical factories that generate valid payloads with unique identities.

For example:

```text
createValidUserPayload()
createValidRegistrationPayload()
```

Fixtures must not become shared mutable state.

Invalid payloads should be derived from fresh valid payloads by modifying only the property relevant to the scenario.

## Data Creation

Create application data through public HTTP endpoints whenever the relevant behavior is available.

For example, when testing user retrieval, creating the user through the public API is preferred over inserting the user
directly through Prisma.

This ensures the prerequisite passes through the same validation and business rules as normal application usage.

## Seeds

Direct persistence seeds are allowed only for explicit preconditions that:

- have no public creation API;
- would be unnecessarily expensive to create through HTTP;
- require high-volume setup;
- represent a special persisted state unavailable through public APIs.

Seeds must be:

- minimal;
- deterministic;
- isolated;
- reproducible;
- performed against the real E2E persistence layer.

A seed must never bypass the behavior the scenario claims to test.

## Assertions

E2E assertions should focus on publicly observable behavior.

Prefer assertions against:

- HTTP status;
- response contracts;
- headers;
- cookies;
- authorization behavior;
- observable persisted effects;
- observable external effects;
- absence of forbidden fields.

Do not assert internal service, repository, or ORM method calls.

When practical, verify persistence effects through a subsequent public HTTP request rather than querying the database
directly.

## Sensitive Output

E2E tests should explicitly verify that sensitive fields are absent from responses where they do not belong.

Examples include:

- passwords;
- password hashes;
- secrets;
- internal security metadata;
- refresh-token persistence values.

## External Services

Keep internal application behavior real.

External out-of-process dependencies may be isolated when calling the real provider would be unsafe, nondeterministic,
expensive, or unavailable.

Examples include:

- email;
- payments;
- SMS;
- webhooks.

Replace only the adapter that crosses the process boundary.

```text
Application flow
      ↓
External adapter
      ↓
Test replacement
```

Do not replace the application service that owns the use case.

The test replacement should capture the outgoing contract so the scenario can verify the expected external effect
without executing the real side effect.

## Teardown

The lifecycle owner must release every resource created by the E2E environment.

This includes applicable:

- NestJS application instances;
- Prisma clients;
- database connections;
- temporary databases;
- external-provider test doubles;
- modified environment state.

Do not rely on forced process termination to hide leaked resources.

## Rules

1. Verify E2E behavior through the public HTTP boundary.
2. Use production-derived application bootstrap behavior.
3. Give each shared E2E environment one explicit lifecycle owner.
4. Configure Vitest discovery to prevent imported suites from executing independently.
5. Prefer independent and reorderable endpoint scenarios.
6. Make intentional ordered business flows explicit through typed contexts.
7. Use isolated real PostgreSQL persistence with committed Prisma migrations.
8. Keep controllers, services, repositories, Prisma, authentication, and other internal application components real.
9. Create prerequisites through HTTP whenever the corresponding public behavior exists.
10. Use direct seeds only for documented and minimal preconditions.
11. Assert public contracts and observable effects rather than internal calls.
12. Explicitly assert that sensitive fields are absent from unrelated responses.
13. Replace only justified out-of-process external adapters.
14. Fully dispose application, database, and test-environment resources after execution.
