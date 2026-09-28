---
title: 'Provide foundational authentication and user access control'
module: auth
area: authentication
slug: authentication
version: '1.9'
status: draft
date_created: '2026-09-25'
last_updated: '2026-09-28'
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

- Allow public registration of ordinary users without requiring email verification in this version. Sign-up requires
  exactly `email`, `displayName`, and `password`; all three are mandatory, and additional fields, including `role` and
  `confirmPassword`, are rejected. Email and display name follow the existing Users normalization rules; the password is
  not trimmed and must contain at least 12 characters. Successful registration automatically signs in the new ordinary
  user and creates a session. Sign-up returns `201 Created` with only the same four-field token response as sign-in,
  without a User body or a `Location` header. A duplicate email returns `409 Conflict`. This exposes whether an email is
  registered, even though sign-in uses the same invalid-credentials error for an absent email and an incorrect password;
  no email verification or notification is assumed.
- Expose registration, login, session renewal, logout, and authenticated current-password change through
  `POST /api/v1/auth/sign-up`, `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/sign-out`,
  and `POST /api/v1/auth/change-password`, respectively. These Auth workflow actions are an exception to the general
  plural-resource URI convention.
- Return tokens in JSON and accept access tokens through the `Authorization: Bearer` header. Sign-up, sign-in, and
  refresh each return exactly `accessToken`, `expiresAt`, `refreshToken`, and `refreshExpiresAt`. `expiresAt` is the
  access-token expiration and `refreshExpiresAt` is the refresh-token expiration; both are absolute UTC ISO 8601
  date-time strings. No password-change-required flag appears in any token response or the JWT. Access JWTs expire after
  15 minutes by default and refresh tokens after 7 days by default; both lifetimes are configurable by environment.
- Sign-in at `POST /api/v1/auth/sign-in` requires strict JSON with exactly `{ email, password }`. Normalize email using
  the Users rules; accept a raw, untrimmed, nonempty password without applying the 12-character enrollment minimum.
  Missing, malformed, or extra fields return `400 BAD_REQUEST`. An absent email and a wrong password return identical
  `401 INVALID_CREDENTIALS` responses without `details`, using the exact message in `docs/api/http-contracts.md`. For
  each normalized email, the first five failures in a 15-minute window return that same `401`; the sixth attempt within
  the window returns `429 RATE_LIMIT_EXCEEDED` even if its credentials are correct. Success before the limit clears
  recent failures; no permanent lock applies. Successful sign-in returns the four-field token response, including for an
  initial-password restricted session without a restriction flag.
- Refresh at `POST /api/v1/auth/refresh` requires strict JSON with exactly `{ refreshToken }`, with a nonempty token;
  missing, malformed, or extra fields return `400 BAD_REQUEST`. No Bearer access token is required. Success rotates the
  token and returns the same four-field token response; a restricted session remains restricted. Unknown, expired,
  revoked, sessionless, or reused rotated tokens return identical `401 INVALID_REFRESH_TOKEN` responses without
  `details`, using the exact message in `docs/api/http-contracts.md`.
- Rotate refresh tokens strictly on renewal. Concurrent requests using the same refresh token revoke the affected
  session; clients must serialize refresh requests. Reuse of a rotated refresh token revokes only the affected session
  and requires a new login; other sessions remain active. Sign-out accepts a refresh token in JSON and immediately
  revokes only that session and its access tokens. An unknown or already revoked refresh token also returns
  `204 No Content` without a body, without restoring any session.
- Require passwords of at least 12 characters without character-class rules. Allow authenticated users to change their
  own password by supplying their current password; a successful change immediately revokes all their sessions,
  including the current one, and requires a new sign-in. An administrator may provide a password only when creating a
  new user; that user must replace the initial password at first sign-in before normal protected access. Administrators
  cannot read, change, or reset an existing user's password. Administrator-created ordinary users and the seeded
  bootstrap administrator have a persistent, user-owned password-change-required condition for initial passwords. The
  condition is read from current Users state, not a JWT claim or token-response field. First and repeated sign-in yield
  sessions restricted to change-password, sign-out, and refresh. A restricted session attempting another protected
  operation receives `403` with the stable public code `PASSWORD_CHANGE_REQUIRED`; refresh remains restricted and never
  elevates access. Repeated sign-in or refresh cannot bypass the requirement. Changing the password clears the condition
  and revokes all sessions; normal access requires a new sign-in. `POST /api/v1/auth/change-password` accepts exactly
  `currentPassword` and `newPassword`, rejects additional fields, and requires a valid access token even during the
  initial-password restriction. The new password must differ from the current password. Success returns `204 No Content`
  without a body or new tokens. An incorrect current password with a valid session returns
  `403 INVALID_CURRENT_PASSWORD`; reusing the current password returns `400 PASSWORD_REUSE_NOT_ALLOWED`. Neither failure
  changes credentials, clears the initial-password restriction, or revokes sessions.
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
  operations. Every response containing a User, including admin creation, retrieval, update, collection and `QUERY`
  items, and `/users/me` reads and updates, uses exactly this six-field projection. `role` reflects current persisted
  state, not JWT authority; passwords, hashes, the initial-password condition, and future fields are excluded.
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
  Authentication establishes identity; authorization and initial-password restrictions use current user state rather
  than trusting JWT claims. Explicit Zod response projection protects the HTTP boundary even when internal results
  contain additional fields; password hashes must never appear in requests, logs or responses. Apply the relevant
  `nestjs-best-practices` security rules for JWT, Guards, and output safety together with `nestjs-practices`, subject to
  repository architecture: Passport is not the default authentication strategy.
- Define the public HTTP representations under `docs/api/` conventions. The shared catalog in
  `docs/api/http-contracts.md` defines `INVALID_CURRENT_PASSWORD`, `PASSWORD_REUSE_NOT_ALLOWED`, and
  `PASSWORD_CHANGE_REQUIRED`, including their exact public messages. Keep concrete runtime settings under
  `docs/configuration/` rather than embedding them in this PDR.
- The current seed is development-only and creates no users (`docs/configuration/database.md`). Supporting controlled
  production initialization requires an explicit change to that documented policy and its implementation; keep
  development-only sample data separate.
- Follow `docs/testing/e2e-testing.md` for real HTTP registration, login, and protected-access scenarios. Existing E2E
  scenarios must continue to create their own isolated fixtures rather than depend on production seeds.
- The Users management PDR (`docs/prd/users/management/users-management-pdr.md`) owns the detailed `/me` request,
  projection, and authorization contract.
- The existing Users management PDR owns its CRUD contract and approved transition to protected access. Its current
  administrative creation contract has no password; the approved future transition in that PDR does not claim the
  current implementation has changed. Future admin-only `POST /api/v1/users` requires an initial password only for new
  user creation; Users hashes and persists it while Auth coordinates the sign-in flow. Keep `/api/v1/users` during this
  template's pre-stable development under the narrow exception in `docs/api/versioning.md`. A Users-owned local Argon2
  provider suffices; extract shared hashing only if a second real consumer emerges.

## 6. Acceptance criteria

- [ ] `POST /api/v1/auth/sign-up` requires exactly `email`, `displayName`, and an untrimmed password of at least 12
      characters, rejecting additional fields including `role` and `confirmPassword`. It creates an ordinary user with
      automatic sign-in and session creation, never granting administrator privileges from input or registration order.
      Success returns `201 Created` with only `{ accessToken, expiresAt, refreshToken, refreshExpiresAt }`, no User body
      and no `Location`; expirations are absolute UTC ISO 8601 date-time strings. A duplicate email returns
      `409 Conflict`, exposing registration existence despite the generic invalid-credentials error at sign-in.
- [ ] `POST /api/v1/auth/sign-in` accepts only JSON `{ email, password }`: email uses Users normalization and password
      is raw, untrimmed, nonempty, and not subject to the 12-character enrollment minimum. Missing, malformed, or extra
      fields return `400 BAD_REQUEST`. Success returns exactly `accessToken`, `expiresAt`, `refreshToken`, and
      `refreshExpiresAt` in JSON without email verification, including for a restricted initial-password session without
      a restriction flag. Expirations are absolute UTC ISO 8601 date-time strings. Absent email and wrong password both
      return `401 INVALID_CREDENTIALS` with the catalog message and no `details`.
- [ ] Passwords require at least 12 characters with no character-class rules. For each normalized email, the first five
      failed sign-in attempts within 15 minutes return `401 INVALID_CREDENTIALS`; the sixth attempt within that interval
      returns `429 RATE_LIMIT_EXCEEDED` even with correct credentials. Success before the limit clears recent failures;
      there is no permanent account lockout.
- [ ] An access token authenticates protected requests through `Authorization: Bearer`; missing or invalid credentials
      are rejected under the public HTTP contract.
- [ ] Access JWTs expire after 15 minutes by default and refresh tokens after 7 days by default, with both lifetimes
      configurable by environment.
- [ ] `POST /api/v1/auth/refresh` accepts only JSON `{ refreshToken }` with a nonempty value and requires no Bearer
      access token; missing, malformed, or extra fields return `400 BAD_REQUEST`. Success rotates refresh tokens and
      returns the same four-field token response with new absolute expiration timestamps; restricted sessions stay
      restricted. Unknown, expired, revoked, sessionless, and reused rotated tokens produce the same
      `401 INVALID_REFRESH_TOKEN` with the catalog message and no `details`. Reuse, including concurrent requests using
      the same token, revokes only the affected session and its access tokens, requires login, and leaves other sessions
      active. Clients serialize refresh requests.
- [ ] `POST /api/v1/auth/sign-out` accepts a refresh token in JSON and immediately revokes only that session and its
      access tokens. An unknown or already revoked refresh token returns `204 No Content` without a body; neither can
      renew or reactivate a session.
- [ ] An administrator can use every existing Users management operation, including granting and revoking admin status
      without demoting or deleting the last active administrator; an ordinary user cannot use those administrative
      operations. Each account has exactly one initial-version role, `user` or `admin`. Administrator-created accounts
      start with role `user`. Admin-only `PATCH /api/v1/users/:userId` accepts optional `role: 'user' | 'admin'`
      alongside optional profile fields; promotion revokes all target sessions and requires new sign-in. Demotion takes
      effect on the next request without terminating sessions.
- [ ] Deleting a user immediately revokes all their sessions and rejects their previously issued access tokens.
- [ ] `POST /api/v1/auth/change-password` accepts exactly `currentPassword` and `newPassword` from an authenticated
      user, including one in an initial-password restricted session, and rejects additional fields. The new password
      must differ from the current one. Success returns `204 No Content` with no body or tokens, revokes all sessions
      immediately, and requires a new sign-in. An incorrect current password with a valid session returns
      `403 INVALID_CURRENT_PASSWORD`; using the current password again returns `400 PASSWORD_REUSE_NOT_ALLOWED`. Neither
      failure changes credentials, clears the initial-password restriction, or revokes sessions. Administrators cannot
      read, change, or reset existing users' passwords.
- [ ] An administrator can create a user with an initial password only at `POST /api/v1/users`; that user and the seeded
      bootstrap administrator receive a persistent password-change-required condition. Neither the token response nor
      the JWT includes this flag. First and repeated sign-in yield sessions permitting only change-password, sign-out,
      and restricted refresh. Other protected operations return `403 PASSWORD_CHANGE_REQUIRED`; repeated refresh cannot
      grant normal access. Changing the password clears the condition, revokes all sessions, and requires new sign-in
      for normal access. Creating a user is the only time an administrator can provide that user's password.
- [ ] `GET /api/v1/users/me` returns exactly `id`, `email`, `displayName`, `createdAt`, `updatedAt`, and the single
      `role`, without automatically exposing future fields. Every response containing a User, including admin Users
      `POST`, `GET`, `PATCH`, collection and `QUERY` items, and `/users/me` `GET` and `PATCH`, uses exactly this
      projection; `role` is current persisted state, not JWT authority. Passwords, hashes, and initial-password
      conditions are never included. An ordinary user can change only their own `displayName` at
      `PATCH /api/v1/users/me`, without changing email, submitting role input, or changing another user's data. Public
      sign-up also rejects role input.
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
- Absolute UTC token expiration fields and a Users-owned initial-password condition are selected over relative lifetimes
  or a password-change flag in tokens. Clients discover the restriction through `403 PASSWORD_CHANGE_REQUIRED`.

### Rejected decisions

- Automatically making the first public registrant an administrator: registration order is not a trusted source of
  privilege.
- Shipping an initial administrator with a default password or committed credentials.
- Using the production seed for test users or sample data.
- Requiring email verification before first login in this version.

### Open questions

- What remaining request details should implement admin creation and the approved optional role update on existing Users
  routes? The six-field User response is settled; the pre-stable template keeps `/api/v1/users` under
  `docs/api/versioning.md`.
- How should deletion and role updates coordinate atomically with session invalidation and last-administrator protection
  across Users and Auth?
