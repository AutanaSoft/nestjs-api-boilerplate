---
title: 'Provide foundational authentication and user access control'
module: auth
area: authentication
slug: authentication
version: '1.8'
status: approved
date_created: '2026-09-25'
last_updated: '2026-09-25'
owner: auth
tags:
  - auth
  - authentication
  - authorization
---

<!-- markdownlint-disable MD025 -->

# Introduction

A reusable REST API starter needs an initial authentication capability and explicit access control for its existing user
management operations. This PDR defines the minimum product behavior and the transition from temporarily public user
management to protected access.

## 1. Problem

User management is currently accessible without credentials as a temporary development measure. Projects created from
this template need a safe way to register and authenticate users, establish an initial administrator, and restrict user
management without treating every authenticated user as an administrator.

## 2. Goal

Provide a reusable authentication baseline with public registration, session renewal and termination, controlled initial
administrator provisioning, and explicit access to user management and personal profiles.

## 3. Scope

### In scope

- Allow public registration of ordinary users without requiring email verification in this version; registration does
  not issue tokens or automatically sign the user in. A duplicate email returns `409 Conflict`. This exposes whether an
  email is registered, even though sign-in uses the same invalid-credentials error for an absent email and an incorrect
  password; no email verification or notification is assumed.
- Expose registration, login, session renewal, logout, and authenticated current-password change through
  `POST /api/v1/auth/sign-up`, `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/sign-out`,
  and `POST /api/v1/auth/change-password`, respectively. These Auth workflow actions are an exception to the general
  plural-resource URI convention.
- Return tokens in JSON and accept access tokens through the `Authorization: Bearer` header. Sign-in and refresh each
  return an access token, a refresh token, and their expiration information. Access JWTs expire after 15 minutes by
  default and refresh tokens after 7 days by default; both lifetimes are configurable by environment.
- Rotate refresh tokens strictly on renewal. Concurrent requests using the same refresh token revoke the affected
  session; clients must serialize refresh requests. Reuse of a rotated refresh token revokes only the affected session
  and requires a new login; other sessions remain active. Sign-out accepts a refresh token in JSON and immediately
  revokes only that session and its access tokens.
- Require passwords of at least 12 characters without character-class rules. Allow authenticated users to change their
  own password by supplying their current password; a successful change immediately revokes all their sessions,
  including the current one, and requires a new sign-in. An administrator may provide a password only when creating a
  new user; that user must replace the initial password at first sign-in before normal protected access. Administrators
  cannot read, change, or reset an existing user's password. Administrator-created ordinary users and the seeded
  bootstrap administrator have a persistent, user-owned password-change-required condition for initial passwords. First
  and repeated sign-in return a JSON flag and restricted tokens/session allowing only change-password, sign-out, and
  refresh. Refresh remains restricted and never elevates access; repeated sign-in or refresh cannot bypass the
  requirement. Changing the password clears the condition and revokes all sessions; normal access requires a new
  sign-in. Failed sign-in returns the same public error for an absent email and an incorrect password; limit failed
  attempts temporarily to 5 per normalized email in 15 minutes, without permanent account lockout.
- Give administrators full access to user management operations, including granting and revoking administrator status,
  while protecting the last active administrator from demotion or deletion. Each account has exactly one role in this
  initial version: `user` or `admin`. Administrator-created accounts start with role `user`. Admin-only
  `PATCH /api/v1/users/:userId` accepts optional `role: 'user' | 'admin'` alongside optional profile fields to grant or
  revoke this privilege. `PATCH /api/v1/users/me` and sign-up reject role input. Promotion revokes all target sessions
  and requires a new sign-in; demotion takes effect on the next request while the session remains valid with ordinary
  user access. Deleting a user immediately revokes all their sessions and invalidates their access tokens.
- Let ordinary users view their own profile at `GET /api/v1/users/me`, returning exactly `id`, `email`, `displayName`,
  `createdAt`, `updatedAt`, and `role`, without automatically exposing future fields. They can update only their own
  `displayName` at `PATCH /api/v1/users/me`; they cannot change their email or access other users' management
  operations. Existing general Users public responses retain their approved five fields without `role`.
- Require authentication and explicit authorization for every existing Users management operation; no administrative
  Users operation remains public after the transition.
- Initialize the first administrator through a controlled production-capable application initialization seed. Supply the
  initial administrator's email and password through environment secrets, not source-controlled defaults. Deployments
  must run initialization before exposing public sign-up; this is not a runtime startup guard.
- Restrict production seed data to application initialization data, never example users or test fixtures. Initialization
  fails before any write if required administrator email or password environment secrets are absent. A collision with an
  existing ordinary user at the bootstrap email fails without promoting or modifying that user. Re-running
  initialization must not reset an existing administrator's password or privileges.
- Keep registration limited to ordinary users: neither registration order nor client input can grant administrator
  privileges.
- Define observable authentication failures, authorization denials, and session behavior consistent with the public HTTP
  conventions.

### Out of scope

- Email verification and email delivery in the first version; a registered email is not proof of mailbox ownership.
- Forgotten-password recovery, administrative password resets, and self-service email changes in the first version. A
  user who forgets their password has no account-recovery path in this starter baseline; a project must add one before
  relying on this capability for production use.
- Cookie-based authentication as the initial public contract.
- External identity providers, social login, and multi-factor authentication.
- Example or test data in production initialization.
- A generic, configurable roles-and-permissions framework without an approved use case.

## 4. Key concepts / Data model

- **Ordinary user:** A publicly registered user who can access their own profile and change only their own display name.
- **Administrator:** A user authorized to perform all existing user management operations; public registration cannot
  assign this privilege.
- **Authenticated principal:** The internal identity established from an access token, separate from authorization.
- **Session:** Server-side state associated with renewable credentials and explicit termination. An initial-password
  session stays restricted on renewal.
- **Access token:** A short-lived JWT presented as a Bearer credential.
- **Refresh token:** An opaque credential with server-side state that supports expiration, rotation, and revocation.
- **Initialization seed:** An explicitly executed operation that creates required application initialization data,
  including the first administrator with role `admin`, without introducing test fixtures into production.

## 5. Implementation notes

- Follow `docs/architecture/authentication.md` for JWT, Argon2id, opaque refresh tokens, module ownership, and
  authentication guards; follow `docs/architecture/authorization.md` for deny-by-default access decisions.
- `AuthModule` must consume an exported `UsersModule` API rather than access the Users repository directly. Users owns
  the user, stored password hash, password hashing, verification, credential change and persistence, and persistent
  password-change-required condition through a focused internal exported API. Auth orchestrates registration, sign-in,
  tokens and sessions through that API; Users does not depend on Auth, and Auth does not access the Users repository.
  The auth guard loads a minimal current safe user projection through the Users API, never a whole record or hash.
  Authentication establishes identity; authorization uses current user state rather than trusting JWT roles. Explicit
  Zod response projection protects the HTTP boundary even when internal results contain additional fields; password
  hashes must never appear in requests, logs or responses.
- Define the public HTTP representations under `docs/api/` conventions, and keep concrete runtime settings under
  `docs/configuration/` rather than embedding them in this PDR.
- The current seed is development-only and creates no users (`docs/configuration/database.md`). Supporting controlled
  production initialization requires an explicit change to that documented policy and its implementation; keep
  development-only sample data separate.
- Follow `docs/testing/e2e-testing.md` for real HTTP registration, login, and protected-access scenarios. Existing E2E
  scenarios must continue to create their own isolated fixtures rather than depend on production seeds.
- The existing Users management PDR owns its CRUD contract and approved transition to protected access. Its current
  administrative creation contract has no password; the approved future transition in that PDR does not claim the
  current implementation has changed. Future admin-only `POST /api/v1/users` requires an initial password only for new
  user creation; Users hashes and persists it while Auth coordinates the sign-in flow. Keep `/api/v1/users` during this
  template's pre-stable development under the narrow exception in `docs/api/versioning.md`. A Users-owned local Argon2
  provider suffices; extract shared hashing only if a second real consumer emerges.

## 6. Acceptance criteria

- [ ] `POST /api/v1/auth/sign-up` creates an ordinary user without tokens or automatic sign-in and never grants
      administrator privileges from input or registration order; a duplicate email returns `409 Conflict`, exposing
      registration existence despite the generic invalid-credentials error at sign-in.
- [ ] A registered user can sign in at `POST /api/v1/auth/sign-in` and receive access and refresh tokens with expiration
      information in JSON without email verification; absent email and incorrect password produce the same public error.
- [ ] Passwords require at least 12 characters with no character-class rules; 5 failed sign-in attempts per normalized
      email in 15 minutes trigger a temporary rate limit without permanent lockout.
- [ ] An access token authenticates protected requests through `Authorization: Bearer`; missing or invalid credentials
      are rejected under the public HTTP contract.
- [ ] Access JWTs expire after 15 minutes by default and refresh tokens after 7 days by default, with both lifetimes
      configurable by environment.
- [ ] `POST /api/v1/auth/refresh` rotates refresh tokens and returns the new access and refresh tokens with expiration
      information; reuse, including concurrent requests using the same token, revokes only the affected session,
      requires login, and leaves other sessions active. Clients serialize refresh requests.
- [ ] `POST /api/v1/auth/sign-out` accepts a refresh token in JSON and immediately revokes only that session and its
      access tokens; a terminated or revoked refresh credential cannot renew it.
- [ ] An administrator can use every existing Users management operation, including granting and revoking admin status
      without demoting or deleting the last active administrator; an ordinary user cannot use those administrative
      operations. Each account has exactly one initial-version role, `user` or `admin`. Administrator-created accounts
      start with role `user`. Admin-only `PATCH /api/v1/users/:userId` accepts optional `role: 'user' | 'admin'`
      alongside optional profile fields; promotion revokes all target sessions and requires new sign-in. Demotion takes
      effect on the next request without terminating sessions.
- [ ] Deleting a user immediately revokes all their sessions and rejects their previously issued access tokens.
- [ ] An authenticated user can change their own password at `POST /api/v1/auth/change-password` with their current
      password; success revokes all their sessions immediately and requires a new sign-in. Administrators cannot read,
      change, or reset existing users' passwords.
- [ ] An administrator can create a user with an initial password only at `POST /api/v1/users`; that user and the seeded
      bootstrap administrator receive a persistent password-change-required condition. First and repeated sign-in return
      a JSON flag and restricted tokens/session allowing only change-password, sign-out, and restricted refresh.
      Repeated refresh cannot grant normal access. Changing the password clears the condition, revokes all sessions, and
      requires new sign-in for normal access. Creating a user is the only time an administrator can provide that user's
      password.
- [ ] `GET /api/v1/users/me` returns exactly `id`, `email`, `displayName`, `createdAt`, `updatedAt`, and the single
      `role`, without automatically exposing future fields; general Users public responses retain their approved five
      fields. An ordinary user can change only their own `displayName` at `PATCH /api/v1/users/me`, without changing
      email, submitting role input, or changing another user's data. Public sign-up also rejects role input.
- [ ] Every Users management operation requires authentication and explicit authorization; unauthenticated and
      authenticated-but-forbidden requests produce the appropriate public failures.
- [ ] An explicitly executed production initialization seed creates the initial administrator using environment-provided
      secrets, never hardcoded credentials or example/test data; absent required email or password secrets fail before
      any write, and a bootstrap email collision with an existing ordinary user fails without modifying or promoting it.
- [ ] Re-running initialization does not reset an existing administrator's password or privileges; deployment runs
      initialization before exposing public sign-up, without adding a runtime startup guard.
- [ ] Real HTTP E2E scenarios cover registration, login, renewal, logout, self-profile access, and administrator versus
      ordinary-user access without relying on production seeds.

## 7. Considered decisions

### Considered options

- Public registration is selected for ordinary users; administrator access is provisioned separately.
- Production-capable initialization seeds are selected over granting the first registrant administrator access.
- JSON tokens and Bearer access are selected for a client-agnostic REST baseline rather than browser-specific cookies.

### Rejected decisions

- Automatically making the first public registrant an administrator: registration order is not a trusted source of
  privilege.
- Shipping an initial administrator with a default password or committed credentials.
- Using the production seed for test users or sample data.
- Requiring email verification before first login in this version.

### Open questions

- What public request and response shapes, beyond the approved routes and sign-out input, are needed for the Auth and
  self-profile operations, including the first-sign-in password-change flow at `POST /api/v1/auth/change-password`?
- What remaining request and response details should implement admin creation and the approved optional role update on
  existing Users routes? The current contract is unchanged pending implementation; the pre-stable template keeps
  `/api/v1/users` under `docs/api/versioning.md`.
- How should deletion and role updates coordinate atomically with session invalidation and last-administrator protection
  across Users and Auth?
