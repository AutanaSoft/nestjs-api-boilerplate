# Project Structure

This document defines the structural architecture conventions for the NestJS API Boilerplate.

The project is organized around feature modules, explicit module sharing, single-responsibility components, and
repository-based persistence boundaries.

## Project Organization

Application features live under:

```text
src/modules/<feature>/
```

Each feature owns its controllers, services, repositories, contracts, and other supporting components.

Cross-feature infrastructure remains outside `src/modules`.

```text
src/
├── modules/
├── database/
├── common/
├── config/
├── app.module.ts
├── app.setup.ts
└── main.ts
```

Application code must not be organized globally by technical layer.

## Feature Structure

Features should remain flat while they are small and introduce responsibility-based directories as they grow.

A small feature may use:

```text
src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
├── users.repository.ts
└── dto/
```

A larger feature may use:

```text
src/modules/users/
├── controllers/
│   ├── users.controller.ts
│   └── user-profile.controller.ts
├── services/
│   ├── users.service.ts
│   └── user-profile.service.ts
├── repositories/
│   └── users.repository.ts
├── dto/
├── contracts/
└── users.module.ts
```

Directories should be introduced because multiple components of the same responsibility exist, not as mandatory
boilerplate.

Component boundaries must follow responsibility rather than preserving a single `<feature>.controller.ts`,
`<feature>.service.ts`, or `<feature>.repository.ts` file.

## Module Boundaries

A feature module is the ownership boundary for an application capability.

Feature-specific code must remain inside its owning module unless it represents genuinely shared infrastructure.

Each provider has one owning module. Consumers import that module instead of redeclaring its providers.

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

```typescript
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

Modules should expose only the providers required by other modules.

Repositories should normally remain private to their owning feature.

## Controllers

Controllers own cohesive transport surfaces and delegate application behavior to services.

They must not contain persistence logic or substantial business logic.

When a feature exposes multiple distinct HTTP responsibilities, those responsibilities should be split across
controllers.

For example:

```text
controllers/
├── users.controller.ts
├── user-profile.controller.ts
└── user-password.controller.ts
```

Controller boundaries should follow HTTP responsibility rather than forcing all endpoints of a feature into one
controller.

## Services

Services own cohesive application or domain behavior.

A feature may contain one or multiple services.

Do not group unrelated responsibilities into a single service only to preserve a `<feature>.service.ts` naming
convention.

For example:

```text
services/
├── orders.service.ts
├── order-pricing.service.ts
└── order-status.service.ts
```

Service boundaries should follow responsibility rather than file-count conventions.

## Repositories

Repositories encapsulate persistence access.

ORM-specific queries, joins, filters, persistence mapping, and related data-access concerns belong in repositories
rather than services.

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Persistence infrastructure
```

A feature may contain multiple repositories when persistence responsibilities are distinct.

Repositories are required only for features that own persistence behavior.

## DTOs and Contracts

Transport-specific input and output definitions belong to the feature that owns the corresponding HTTP boundary.

Feature-owned reusable schemas and types belong to the same feature and should remain separate from persistence
implementation details.

Typical locations are:

```text
dto/
contracts/
```

Their detailed ownership and validation conventions are defined separately from this structural document.

## Infrastructure

Cross-feature infrastructure lives outside `src/modules`.

Examples include:

```text
src/database/
src/config/
src/common/
```

Infrastructure modules may expose technical capabilities required by feature repositories or other infrastructure
components.

Application services should depend on feature abstractions rather than directly on persistence clients.

## Shared Code

`src/common` is reserved for genuinely cross-cutting code without a natural feature owner.

Code must not be moved into `common` merely because it is reused or because its ownership is unclear.

Prefer keeping behavior with the feature that owns it.

## Rules

1. Organize application functionality by feature under `src/modules`.
2. Keep feature-specific components inside their owning module.
3. Keep features flat while small and introduce responsibility-based directories as they grow.
4. Split controllers, services, and repositories by cohesive responsibility when necessary.
5. Give each provider one owning module.
6. Share providers through module imports and explicit exports.
7. Keep controllers focused on transport concerns.
8. Keep services focused on one cohesive responsibility.
9. Encapsulate persistence access in repositories.
10. Keep ORM-specific logic outside application services.
11. Keep feature repositories private unless a documented requirement justifies exposing them.
12. Keep shared infrastructure outside `src/modules`.
