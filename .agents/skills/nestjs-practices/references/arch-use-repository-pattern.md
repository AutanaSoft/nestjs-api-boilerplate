---
title: Use repositories for persistence access
impact: HIGH
impactDescription: Keeps persistence queries and mapping outside services
tags: nestjs, repositories, persistence
---

## Use repositories for persistence access

**Impact: HIGH (keeps persistence queries and mapping outside services)**

Keep persistence queries, query shapes, schemas, and mappers in repositories. Services consume a
domain-oriented repository API; repository operations that join a transaction accept its executor
rather than creating an independent transaction.

**Incorrect (a service contains a persistence query):**

```typescript
class RateInfoService {
  async update(id: string, input: UpdateInput) {
    return this.db.rateInfo.update({ where: { id }, data: input });
  }
}
```

**Correct (the service delegates persistence):**

```typescript
class RateInfoService {
  constructor(private readonly repository: RateInfoRepository) {}
  async update(id: string, input: UpdateInput) {
    return this.repository.updateById(id, input);
  }
}
```

Reference: [NestJS: Providers](https://docs.nestjs.com/providers)
