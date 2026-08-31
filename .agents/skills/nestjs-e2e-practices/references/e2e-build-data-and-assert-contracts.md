---
title: Build realistic E2E data and assert public contracts
impact: HIGH
impactDescription: Keeps scenarios valid, isolated, and capable of detecting public API regressions
tags: nestjs, e2e, fixtures, api-contract
---

## Build realistic E2E data and assert public contracts

**Impact: HIGH (keeps scenarios valid, isolated, and capable of detecting public API regressions)**

### Rule

Create fixtures through public HTTP endpoints whenever that behavior is available; the setup must
exercise the same validation and business rules that the scenario depends on. Every allowed seed
must be explicit, deterministic, minimal, reproducible, isolated, performed against real
persistence, and used only as a precondition. It is allowed only for an incidental precondition that
has no API, would be needlessly costly to create through the API, or requires high-volume setup.
Document which condition applies, seed only the minimum records, and never use a seed to bypass the
behavior under test. Exercise that behavior through HTTP.

Use canonical valid payload constants or factories with unique identities. Derive each invalid case
from a fresh valid value, changing only the property under test and copying every nested branch that
changes. Fixtures own fresh request data; seeds own narrowly justified persisted preconditions;
typed contexts own only values deliberately shared by an ordered business flow. None is a general
mutable state store.

Prioritize externally observable E2E assertions: HTTP status, response body or schema, headers,
cookies, authorization behavior, persisted effects, observable external effects, and forbidden
fields. For persisted effects, use an observable follow-up HTTP read when practical; for external
effects, assert the externally visible result. Explicitly assert that passwords, hashes, secrets,
internal metadata, and tokens not owned by that endpoint's contract are absent. Reject service,
repository, ORM, and other internal method-call assertions: they couple an E2E test to
implementation rather than its public behavior. Prefer public schemas or focused structural matchers
over opaque snapshots and brittle equality on volatile values.

### Why it matters

- HTTP-created data verifies the same validation and business invariants consumers use.
- Bounded seeds make only justified incidental, costly, unavailable, or high-volume preconditions
  practical.
- A valid canonical base isolates which mutation causes an invalid request.
- Fresh factories and unique identities prevent order dependence and parallel-run collisions.
- Status-only assertions and internal-call spies miss public serialization and behavior regressions.
- Observable follow-up requests prove that a command changed persisted behavior.

### Exceptions and limits

- Seed an administrative or legacy state when it has no public route; a bounded seed may also create
  a documented incidental, costly, or high-volume precondition. It cannot stand in for the endpoint
  behavior the test claims to cover.
- Object spread is shallow. Copy every modified nested object or array, or use a factory that
  creates a fresh graph.
- A login endpoint may intentionally return access and refresh tokens. Assert their public shape
  there, while forbidding them from unrelated responses.
- Do not freeze generated IDs, timestamps, or order unless the public contract guarantees them.
- Avoid shared mutable fixtures even when Jest currently executes the suite serially.

### Examples

**Incorrect (bypasses registration with a seed, mutates shared data, and checks internals):**

```typescript
await prisma.user.create({ data: createValidUserPayload() }); // Invalid: seeds the registration behavior under test.
expect(usersService.create).toHaveBeenCalled();

VALID_USER_PAYLOAD.profile.displayName = '';
await request(app.getHttpServer()).post('/users').send(VALID_USER_PAYLOAD).expect(400);
```

**Correct (uses fresh HTTP-created data and asserts public intent):**

```typescript
const validPayload = createValidUserPayload();
const created = await request(app.getHttpServer()).post('/users').send(validPayload).expect(201);

expect(created.body).toEqual(
  expect.objectContaining({
    id: expect.any(String),
    email: validPayload.email,
  })
);
expect(created.body).not.toHaveProperty('password');
expect(created.body).not.toHaveProperty('passwordHash');

const fetched = await request(app.getHttpServer()).get(`/users/${created.body.id}`).expect(200);
expect(fetched.body).toEqual(expect.objectContaining({ email: validPayload.email }));

const validInvalidBase = createValidUserPayload();
const invalidPayload = { ...validInvalidBase, email: 'invalid-email' };
const invalid = await request(app.getHttpServer()).post('/users').send(invalidPayload).expect(400);

expect(invalid.body).toEqual(expect.objectContaining({ error: expect.anything() }));
```

A deterministic, isolated seed against real persistence can establish only a precondition, not the
behavior under test:

```typescript
// Valid: exactly 500 users are the high-volume precondition for HTTP pagination.
await seedUsersInRealPersistence({ count: 500, namespace: testRunId });
const page = await request(app.getHttpServer()).get('/users?page=2&limit=25').expect(200);
expect(page.body).toEqual(expect.objectContaining({ items: expect.any(Array) }));
```

A seed is also valid for a documented legacy state with no public creation route:

```typescript
const archivedAccount = await seedArchivedLegacyAccount({ email: uniqueEmail() });
await request(app.getHttpServer()).post(`/accounts/${archivedAccount.id}/restore`).expect(200);
```

For a nested mutation, copy the branch explicitly:

```typescript
const base = createValidUserPayload();
const invalidProfile = {
  ...base,
  profile: { ...base.profile, displayName: '' },
};
```

### Related cards

- [Orchestrate E2E execution and lifecycle explicitly](./e2e-orchestrate-execution-and-lifecycle.md)
- [Run the real application and isolated infrastructure](./e2e-run-real-application-and-infrastructure.md)

Reference: [NestJS testing](https://docs.nestjs.com/fundamentals/testing),
[NestJS serialization](https://docs.nestjs.com/techniques/serialization),
[Jest expect matchers](https://jestjs.io/docs/expect), and
[MDN spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax).
