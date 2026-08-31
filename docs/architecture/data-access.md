# Data Access

This document defines the persistence architecture for the NestJS API Boilerplate.

The project uses PostgreSQL as the default relational database and Prisma as its ORM.

## Persistence Boundary

Feature modules access persistence through repositories.

Application services must not depend directly on Prisma Client or contain Prisma-specific queries.

The default dependency direction is:

```text
Service
   ↓
Repository
   ↓
Prisma
   ↓
PostgreSQL
```

Repositories own persistence-specific behavior and keep ORM implementation details outside application services.

## Repository Ownership

Repositories belong to the feature that owns the persisted data.

```text
src/modules/users/
└── repositories/
    └── users.repository.ts
```

A repository may remain at the feature root while the feature is small and move into `repositories/` as the feature
grows.

Repositories should normally remain private to their owning module.

Other modules should consume the feature's exported service API rather than its repositories.

## Repository Responsibilities

Repositories are responsible for:

- Prisma queries;
- relation loading;
- filters and ordering;
- persistence-specific projections;
- database writes;
- persistence mapping when required;
- transaction-aware persistence operations.

Repositories should expose operations meaningful to the application rather than exposing Prisma Client directly.

For example:

```typescript
@Injectable()
export class UsersRepository {
  findById(id: string) {}

  findByEmail(email: string) {}

  create(input: CreateUserPersistenceInput) {}

  updateById(id: string, input: UpdateUserPersistenceInput) {}

  deleteById(id: string) {}
}
```

## Database Infrastructure

Prisma client construction and lifecycle belong to database infrastructure outside feature modules.

```text
src/
├── database/
└── modules/
```

Feature repositories consume the database infrastructure through dependency injection.

Application services must not inject the Prisma client directly.

## Prisma Schema

The Prisma schema and migration history live outside `src`.

```text
prisma/
├── schema.prisma
└── migrations/
```

The Prisma schema defines the persistence model. It must not be treated as the application or HTTP contract.

Application inputs, outputs, and persistence records remain separate concerns.

## Migrations

Database schema changes must be versioned through Prisma Migrate.

Migration files are part of the repository and must be reviewed alongside the application changes that require them.

Schema changes must not depend on manually modifying production databases.

`prisma db push` may be used for local prototyping when appropriate, but it does not replace migration history for
application changes intended to be committed.

## Transactions

Use transactions when a single application operation requires multiple database writes that must succeed or fail
together.

Transaction ownership belongs to the application operation that defines the atomic boundary.

Repositories participating in that operation must execute through the same transaction context.

Do not create independent transactions inside repositories when doing so would break a broader application transaction.

## Relations and N+1 Queries

Repositories are responsible for loading relations efficiently.

Do not load collections and then execute one database query per record to retrieve related data.

Avoid patterns equivalent to:

```text
load users
   ↓
for each user
   ↓
load user's relations
```

Prefer relation queries that allow Prisma to resolve the required data as part of the repository operation.

Use `select` or `include` deliberately and request only relations required by the application operation.

When supported and appropriate, prefer relation loading strategies that avoid unnecessary round trips to the database.

Query behavior should be verified when working with large collections or nested relations rather than assuming that ORM
abstraction guarantees optimal execution.

## Query Scope

Repositories should retrieve only the data required by their caller.

Prefer explicit projections when an operation requires a subset of a model.

Avoid loading complete relational graphs by default.

Relation loading must be intentional and belong to the repository operation responsible for the query.

## Raw Queries

Use Prisma's normal query API by default.

Raw SQL should be reserved for cases where the required database behavior cannot be expressed clearly or efficiently
through the regular Prisma API.

Raw queries must remain inside the persistence boundary and must use parameterized APIs.

Application services must not contain raw SQL.

## Persistence Contracts

Persistence structures must not be used directly as HTTP or application input contracts.

For example, a Prisma-generated user type must not become the request contract for creating a user.

Application and persistence concerns may share fields while remaining separate contracts.

This prevents persistence-specific fields from unintentionally becoming part of the public application API.

## Rules

1. Use PostgreSQL as the default relational database.
2. Use Prisma as the default ORM.
3. Access persistence through feature-owned repositories.
4. Keep Prisma-specific logic inside the persistence boundary.
5. Do not inject Prisma Client directly into application services.
6. Keep repositories private to their feature by default.
7. Version database changes with Prisma Migrate.
8. Use shared transactions for operations that require atomic multi-step persistence.
9. Prevent N+1 queries by designing relation loading at the repository level.
10. Load only the fields and relations required by an operation.
11. Keep raw SQL inside repositories and use parameterized APIs.
12. Keep persistence models separate from application and transport contracts.
