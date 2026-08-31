# Authentication

This document defines the authentication architecture for the NestJS API Boilerplate.

Authentication is owned by the `auth` feature and remains separate from user management.

## Module Boundary

Authentication belongs under:

```text
src/modules/auth/
```

User management belongs to a separate feature:

```text
src/modules/users/
```

`AuthModule` may depend on the public API exported by `UsersModule`, but it must not access user persistence directly.

```text
AuthService
    ↓
UsersService
    ↓
UsersRepository
```

Authentication-specific persistence remains owned by the authentication feature.

## Responsibilities

`AuthModule` owns:

- registration workflows;
- credential validation;
- login;
- access token generation and validation;
- refresh token lifecycle;
- authentication guards;
- authentication configuration.

`UsersModule` owns:

- user data;
- user creation and management;
- user lookup;
- user state required by other application features.

Authentication concerns must not be added to `UsersService` simply because authentication operates on users.

## Registration

Registration is an authentication use case, not a generic user CRUD operation.

The registration flow should:

```text
Validate input
    ↓
Check account availability
    ↓
Hash credentials
    ↓
Create user
    ↓
Issue authentication tokens
```

`AuthService` coordinates the registration workflow while `UsersService` remains responsible for user creation.

Plain-text passwords must never be persisted.

## Login

Login validates submitted credentials and issues authentication tokens.

```text
Credentials
    ↓
Find user
    ↓
Verify password
    ↓
Validate account state
    ↓
Issue tokens
```

Authentication failures should not reveal whether an account exists unless the public API explicitly requires that
distinction.

## Password Storage

Passwords must be processed with a password-hashing algorithm designed for credential storage.

Persist only the resulting password hash.

```text
Password
   ↓
Password hashing
   ↓
Password hash
   ↓
Persistence
```

Passwords and password hashes must never be returned through public API responses or included in authentication tokens.

## Access Tokens

The project uses JWT access tokens for authenticated API requests.

Access tokens should be short-lived.

JWT payloads must contain only the minimum information required to identify and validate the authenticated principal.

Sensitive information must not be stored in token payloads.

The user identifier should be represented by the standard `sub` claim.

Token validation must include expiration and configured signing constraints.

## Refresh Tokens

Refresh tokens allow clients to obtain new access tokens without repeatedly submitting credentials.

Refresh tokens must have a longer lifetime than access tokens and remain independently revocable.

Server-side persistence must not store reusable refresh token credentials in plain text.

A compromised persisted token representation should not be sufficient to authenticate as the user.

Refresh-token rotation should invalidate the previously used token when a new token is issued.

## Token Configuration

Authentication configuration belongs to the `auth` feature.

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

Configuration should include values such as:

- signing secrets or keys;
- token lifetimes;
- issuer;
- audience.

Secrets must enter the application through the configuration boundary and must never be hardcoded.

## Request Authentication

Protected routes must use NestJS guards to enforce authentication.

Authentication logic must not be repeated manually inside controllers.

The authentication boundary should:

1. extract the access token;
2. validate the token;
3. validate the authenticated principal when required;
4. expose the authenticated principal to the request context.

Expired, invalid, or otherwise unacceptable tokens must result in an authentication failure.

## User Validation

A valid JWT signature alone does not guarantee that the associated account should still have access.

Authentication may additionally validate relevant account state, such as whether the user:

- still exists;
- is active;
- has been disabled;
- has undergone a security change that invalidates previously issued tokens.

The exact account states supported by the application may evolve independently from the token mechanism.

## Security Boundaries

Authentication implementations must not:

- expose passwords or password hashes;
- include sensitive information in JWT payloads;
- hardcode token secrets;
- accept expired tokens;
- store reusable refresh credentials in plain text;
- expose authentication internals through controllers;
- bypass feature boundaries to access user persistence directly.

## Rules

1. Keep authentication and user management as separate feature responsibilities.
2. Coordinate registration through `AuthService` while delegating user management to `UsersService`.
3. Hash passwords before persistence and never store plain-text credentials.
4. Use short-lived JWT access tokens.
5. Keep JWT payloads minimal and free of sensitive data.
6. Use independently revocable refresh tokens.
7. Store refresh-token persistence representations securely rather than reusable plain-text tokens.
8. Rotate refresh tokens when they are used.
9. Keep authentication secrets in validated feature-owned configuration.
10. Protect authenticated routes through guards.
11. Validate relevant user state during authentication when required.
12. Keep authentication-specific persistence inside the `auth` feature.
