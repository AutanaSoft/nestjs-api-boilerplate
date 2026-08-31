# Architecture Overview

The NestJS API Boilerplate follows a modular application architecture built around explicit feature boundaries.

The architecture is designed to remain simple for small APIs while allowing individual features to grow without
requiring a repository-wide restructuring.

## Architectural Model

Application capabilities are implemented as independent NestJS feature modules.

Each module owns a cohesive functional area and exposes only the capabilities required by other modules.

Modules collaborate through explicit NestJS imports and exports rather than shared internal implementation details.

## Principles

### Feature Ownership

Application behavior belongs to the feature responsible for it.

A feature owns its transport, application logic, persistence access, contracts, and supporting components unless a
concern is genuinely shared across the application.

### Explicit Boundaries

Dependencies between modules must be visible through module imports and exported providers.

Internal providers should remain private unless another module has a concrete reason to consume them.

### Single Responsibility

Controllers, services, repositories, and other providers should have cohesive responsibilities.

Components should be split when they begin to own unrelated behavior rather than growing into general-purpose classes.

### Persistence Isolation

Application services should not depend directly on ORM-specific APIs.

Persistence behavior is isolated behind repositories so database implementation details remain outside application
logic.

### Infrastructure Separation

Cross-cutting infrastructure such as database connectivity and application configuration is separate from application
feature modules.

Infrastructure supports features but does not define their application responsibilities.

### Incremental Complexity

Architectural structure should grow with actual application requirements.

Small features may remain simple. Larger features may introduce additional controllers, services, repositories, or
internal organization without changing the overall architectural model.

### Technology Independence

Structural architecture should not depend unnecessarily on a specific database, ORM, authentication strategy, or
external provider.

Technology-specific decisions must respect the architectural boundaries defined by the project.

## Dependency Direction

The typical dependency flow is:

```text
Transport
   ↓
Application
   ↓
Persistence
   ↓
Infrastructure
```

Dependencies should preserve these boundaries and prevent lower-level implementation details from leaking into
higher-level application responsibilities.

Between features, dependencies must pass through explicitly exposed module APIs.

## Architectural Scope

This architecture defines the default conventions for applications created from the boilerplate.

It does not enforce Clean Architecture, Hexagonal Architecture, Domain-Driven Design, or another formal architecture in
full.

Patterns from those approaches may be adopted when they improve boundaries, maintainability, or testability. Additional
architectural complexity must be justified by application requirements.
