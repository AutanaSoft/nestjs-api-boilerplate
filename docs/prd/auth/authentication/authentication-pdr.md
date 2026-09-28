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
this template need a safe way to register and authenticate users and protect user management while allowing
authenticated users to read profiles and manage only their own account.

## 2. Goal

Provide a reusable authentication baseline with public registration, session renewal and termination, and explicit
self-service access to user management and personal profiles.

## 3. Scope

### In scope

- Allow public registration of ordinary users without requiring email verification in this version. Sign-up requires
  exactly `email`, `displayName`, and `password`; all three are mandatory, and additional fields, including `role` and
  `confirmPassword`, are rejected. Email and display name follow the existing Users normalization rules; the password is
  not trimmed and must contain at least 12 characters. Successful registration automatically signs in the new ordinary
  user with role `user` and creates a session. Sign-up returns `201 Created` with only the same four-field token
  response as sign-in, without a User body or a `Location` header. A duplicate email returns `409 Conflict`. This
  exposes whether an email is registered, even though sign-in uses the same invalid-credentials error for an absent
  email and an incorrect password; no email verification or notification is assumed.
- Expose registration, login, session renewal, logout, and authenticated current-password change through
  `POST /api/v1/auth/sign-up`, `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/sign-out`,
  and `POST /api/v1/auth/change-password`, respectively. These Auth workflow actions are an exception to the general
  plural-resource URI convention.
- Return tokens in JSON and accept access tokens through the `Authorization: Bearer` header. Sign-up, sign-in, and
  refresh each return exactly `accessToken`, `expiresAt`, `refreshToken`, and `refreshExpiresAt`. `expiresAt` is the
  access-token expiration and `refreshExpiresAt` is the refresh-token expiration; both are absolute UTC ISO 8601
  date-time strings. Access JWTs expire after 15 minutes by default and refresh tokens after 7 days by default; both
  lifetimes are configurable by environment.
- Sign-in at `POST /api/v1/auth/sign-in` requires strict JSON with exactly `{ email, password }`. Normalize email using
  the Users rules; accept a raw, untrimmed, nonempty password without applying the 12-character enrollment minimum.
  Missing, malformed, or extra fields return `400 BAD_REQUEST`. An absent email and a wrong password return identical
  `401 INVALID_CREDENTIALS` responses without `details`, using the exact message in `docs/api/http-contracts.md`.
  Successful sign-in returns the four-field token response. Sign-up and sign-in each have an independent 10-request-per-
  minute limit per IP address, in addition to the configurable global limit (default 100 requests per 60 seconds).
  Exceeding a limit returns `429 RATE_LIMIT_EXCEEDED`; no per-email failure lockout applies.
- Refresh at `POST /api/v1/auth/refresh` requires strict JSON with exactly `{ refreshToken }`, with a nonempty token;
  missing, malformed, or extra fields return `400 BAD_REQUEST`. No Bearer access token is required. Success rotates the
  token and returns the same four-field token response. Unknown, expired, revoked, sessionless, or reused rotated tokens
  return identical `401 INVALID_REFRESH_TOKEN` responses without `details`, using the exact message in
  `docs/api/http-contracts.md`.
- Rotate refresh tokens strictly on renewal. Concurrent requests using the same refresh token revoke the affected
  session; clients must serialize refresh requests. Reuse of a rotated refresh token revokes only the affected session
  and requires a new login; other sessions remain active. Sign-out requires a valid `Authorization: Bearer` access
  token, with no JSON refresh token or request body, and immediately revokes only that access token's server-side
  session, including its refresh and access credentials. Success returns `204 No Content` without a body; missing or
  invalid Bearer credentials return `401 UNAUTHORIZED`.
- Require new passwords of at least 12 raw, untrimmed characters without character-class rules. Allow authenticated
  users to change their own password by supplying their current password; verification of `currentPassword` does not
  apply the 12-character enrollment minimum. A successful change immediately revokes all their sessions, including the
  current one, and requires a new sign-in. `POST /api/v1/auth/change-password` accepts exactly `currentPassword` and
  `newPassword`, rejects additional fields, and requires a valid access token. Invalid new-password input returns
  `400 BAD_REQUEST`; a new password equal to the current password returns `400 PASSWORD_REUSE_NOT_ALLOWED`. Success
  returns `204 No Content` without a body or new tokens. An incorrect current password with a valid session returns
  `403 INVALID_CURRENT_PASSWORD`. Neither failure changes credentials nor revokes sessions.
- Public sign-up is the only user-creation route. Every account has exactly one role, `user`; clients cannot assign or
  change roles. Deleting one's own account immediately revokes all its sessions and invalidates its access tokens.
- Let authenticated users read all users, including individual, list, and `QUERY` results. The Users management PDR owns
  viewer-dependent response projection: self includes email; another user's representation excludes email, including
  list and `QUERY` items.
- Let users update only their own `displayName` through `PATCH /api/v1/users/me` or `PATCH /api/v1/users/:userId`, and
  delete only their own account through `DELETE /api/v1/users/:userId`. Email is immutable after sign-up. Require
  authentication for all Users routes and reject cross-account writes.
- Define observable authentication failures, authorization denials, and session behavior consistent with the public HTTP
  conventions.

### Out of scope

- Email verification and email delivery in the first version; a registered email is not proof of mailbox ownership.
- Forgotten-password recovery, administrative password resets, and self-service email changes in the first version. A
  user who forgets their password has no account-recovery path in this starter baseline; a project must add one before
  relying on this capability for production use.
- Cookie-based authentication as the initial public contract.
- External identity providers, social login, and multi-factor authentication.
- Administrative user creation, administrator roles and role changes, and initial-password restrictions.
- Per-email sign-in failure lockouts and production user seeds.
- A generic, configurable roles-and-permissions framework without an approved use case.

## 4. Key concepts / Data model

- **User:** A publicly registered account with the sole `user` role; authenticated users can read other profiles but can
  update or delete only their own account.
- **Authenticated principal:** The internal identity established from an access token, separate from authorization.
- **Session:** Server-side state associated with renewable credentials and explicit termination.
- **Access token:** A short-lived JWT presented as a Bearer credential.
- **Refresh token:** An opaque credential with server-side state that supports expiration, rotation, and revocation.

## 5. Implementation notes

- Follow `docs/architecture/authentication.md` for JWT, Argon2id, opaque refresh tokens, module ownership, and
  authentication guards; follow `docs/architecture/authorization.md` for deny-by-default access decisions.
- `AuthModule` must consume an exported `UsersModule` API rather than access the Users repository directly. Users owns
  the user, stored password hash, password hashing, verification, credential change and persistence through a focused
  internal exported API. Auth orchestrates registration, sign-in, tokens and sessions through that API; Users does not
  depend on Auth, and Auth does not access the Users repository. The auth guard loads a minimal current safe user
  projection through the Users API, never a whole record or hash. Authentication establishes identity; authorization
  uses current user state rather than trusting JWT claims. Explicit Zod response projection protects the HTTP boundary
  even when internal results contain additional fields; password hashes must never appear in requests, logs or
  responses. Apply the relevant `nestjs-best-practices` security rules for JWT, Guards, and output safety together with
  `nestjs-practices`, subject to repository architecture: Passport is not the default authentication strategy.
- Define the public HTTP representations under `docs/api/` conventions. The shared catalog in
  `docs/api/http-contracts.md` defines `INVALID_CURRENT_PASSWORD` and `PASSWORD_REUSE_NOT_ALLOWED`, including their
  exact public messages. Keep concrete runtime settings under `docs/configuration/` rather than embedding them in this
  PDR.
- Follow `docs/testing/e2e-testing.md` for real HTTP registration, login, and protected-access scenarios. Existing E2E
  scenarios must continue to create their own isolated fixtures rather than depend on production seeds.
- The Users management PDR (`docs/prd/users/management/users-management-pdr.md`) solely owns Users HTTP response
  projection, including viewer-dependent email visibility for individual, list, and `QUERY` results, and the detailed
  Users CRUD and authorization transition. This draft describes future behavior, not the current implementation. A
  Users-owned local Argon2 provider suffices; extract shared hashing only if a second real consumer emerges.

## 6. Acceptance criteria

- [ ] `POST /api/v1/auth/sign-up` requires exactly `email`, `displayName`, and an untrimmed password of at least 12
      characters, rejecting additional fields including `role` and `confirmPassword`. It creates an ordinary user with
      automatic sign-in and session creation with the sole `user` role. Sign-up is the only creation route. Success
      returns `201 Created` with only `{ accessToken, expiresAt, refreshToken, refreshExpiresAt }`, no User body and no
      `Location`; expirations are absolute UTC ISO 8601 date-time strings. A duplicate email returns `409 Conflict`,
      exposing registration existence despite the generic invalid-credentials error at sign-in.
- [ ] `POST /api/v1/auth/sign-in` accepts only JSON `{ email, password }`: email uses Users normalization and password
      is raw, untrimmed, nonempty, and not subject to the 12-character enrollment minimum. Missing, malformed, or extra
      fields return `400 BAD_REQUEST`. Success returns exactly `accessToken`, `expiresAt`, `refreshToken`, and
      `refreshExpiresAt` in JSON without email verification. Expirations are absolute UTC ISO 8601 date-time strings.
      Absent email and wrong password both return `401 INVALID_CREDENTIALS` with the catalog message and no `details`.
- [ ] Passwords require at least 12 characters with no character-class rules at enrollment. The configurable global rate
      limit defaults to 100 requests per 60 seconds; sign-up and sign-in each have an independent 10-per-minute per-IP
      limit. Exceeding a limit returns `429 RATE_LIMIT_EXCEEDED`; no per-email failure lockout applies.
- [ ] An access token authenticates protected requests through `Authorization: Bearer`; missing or invalid credentials
      are rejected under the public HTTP contract.
- [ ] Access JWTs expire after 15 minutes by default and refresh tokens after 7 days by default, with both lifetimes
      configurable by environment.
- [ ] `POST /api/v1/auth/refresh` accepts only JSON `{ refreshToken }` with a nonempty value and requires no Bearer
      access token; missing, malformed, or extra fields return `400 BAD_REQUEST`. Success rotates refresh tokens and
      returns the same four-field token response with new absolute expiration timestamps. Unknown, expired, revoked,
      sessionless, and reused rotated tokens produce the same `401 INVALID_REFRESH_TOKEN` with the catalog message and
      no `details`. Reuse, including concurrent requests using the same token, revokes only the affected session and its
      access tokens, requires login, and leaves other sessions active. Clients serialize refresh requests.
- [ ] `POST /api/v1/auth/sign-out` requires a valid `Authorization: Bearer` access token and no JSON refresh token or
      request body. It immediately revokes only that access token's server-side session, including its refresh and
      access credentials, and returns `204 No Content` without a body. Missing or invalid Bearer credentials return
      `401 UNAUTHORIZED`.
- [ ] Every account has exactly one role, `user`; no user-management route creates users or changes roles.
- [ ] Deleting one's own account immediately revokes all its sessions and rejects its previously issued access tokens.
- [ ] `POST /api/v1/auth/change-password` accepts exactly `currentPassword` and `newPassword` from an authenticated user
      and rejects additional fields. `newPassword` is raw and untrimmed, with a minimum of 12 characters and no
      character-class rules; verifying `currentPassword` does not impose that enrollment minimum. Invalid new input
      returns `400 BAD_REQUEST`, while equality with the current password returns `400 PASSWORD_REUSE_NOT_ALLOWED`.
      Success returns `204 No Content` with no body or tokens, revokes all sessions immediately, and requires a new
      sign-in. An incorrect current password with a valid session returns `403 INVALID_CURRENT_PASSWORD`. Neither
      failure changes credentials or revokes sessions. Users cannot read, change, or reset another user's password.
- [ ] Every Users route requires authentication. Authenticated users can read all users, including individual, list, and
      `QUERY` results; only the owner can update their `displayName` or delete their account. Email is immutable after
      sign-up and cross-account writes are forbidden. The Users management PDR solely defines viewer-dependent User
      response projection: self includes email, while other users omit email, including list and `QUERY` items.
- [ ] Real HTTP E2E scenarios cover registration, login, renewal, logout, authenticated read-all, and owner-only profile
      updates and deletion without relying on production seeds.

## 7. Considered decisions

### Considered options

- Public registration is the sole account-creation route; the sole role is `user`.
- JSON tokens and Bearer access are selected for a client-agnostic REST baseline rather than browser-specific cookies.
- Absolute UTC token expiration fields are selected over relative lifetimes.

### Rejected decisions

- Administrator provisioning, role changes, and forced initial-password changes are outside this minimal template.
- Per-email failure lockout is replaced by independent per-IP sign-up and sign-in limits.
- Requiring email verification before first login in this version.

### Open questions

- How should Users and Auth coordinate self-deletion so user removal and invalidation of all sessions complete
  atomically on commit?
