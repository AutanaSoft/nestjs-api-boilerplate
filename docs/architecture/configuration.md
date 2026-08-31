# Configuration

This document defines the application configuration conventions for the NestJS API Boilerplate.

The project uses `@nestjs/config` for configuration registration and dependency injection, with Zod for runtime
validation.

## Configuration Boundaries

External configuration sources must remain isolated from application consumers.

Examples include:

- environment variables;
- secret managers;
- mounted configuration files;
- external configuration services.

Application services and feature components must not access `process.env` or external secret providers directly.

External values must first pass through a configuration boundary and be exposed as validated, typed configuration.

```text
External source
      ↓
Configuration factory
      ↓
Validation
      ↓
Typed configuration
      ↓
Application consumer
```

## Namespaced Configuration

Configuration should be grouped into cohesive namespaces.

Examples include:

```text
http
database
auth
```

Each namespace owns:

- its external inputs;
- defaults;
- normalization;
- derived values;
- validation;
- final configuration type.

Namespaces must use short, stable semantic names.

## Configuration Ownership

Configuration should live with the architectural boundary that owns it.

Application-wide configuration may live under:

```text
src/config/
```

Feature-specific configuration may live inside the owning feature.

For example:

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

Infrastructure-specific configuration may live with its infrastructure module.

```text
src/database/
└── config/
    └── database.config.ts
```

Do not move configuration into a global directory when a clearer owner exists.

## Configuration Factories

Each namespace should expose a named factory responsible for constructing the complete final configuration object.

The factory should apply:

1. defaults;
2. explicit external overrides;
3. normalization and derived values;
4. final validation.

The final object must be valid before it becomes available to application consumers.

```typescript
export const authConfigFactory = (): AuthConfig => {
  const candidate = {
    // defaults, external values and derived values
  };

  return authConfigSchema.parse(candidate);
};
```

The namespace is then registered through `registerAs`.

```typescript
const authConfig = registerAs<AuthConfig>('auth', authConfigFactory);

export default authConfig;
```

Avoid anonymous factories that return unvalidated or partial configuration.

## Validation

Configuration must fail during application startup when required values are missing or invalid.

Do not defer configuration errors until a request reaches the affected feature.

Zod schemas should validate the final configuration contract after defaults, normalization, and transformations have
been applied.

Configuration consumers must not repeat validation already owned by the configuration namespace.

## External Values

External configuration values should be treated as untrusted input.

Environment values may require:

- trimming;
- numeric coercion;
- URL validation;
- boolean normalization;
- list parsing;
- range validation.

Defaults must be selected through explicit absence checks rather than truthiness when an empty value should be
considered invalid.

For example, prefer:

```typescript
const value = process.env.VALUE === undefined ? DEFAULT_VALUE : process.env.VALUE;
```

over:

```typescript
const value = process.env.VALUE || DEFAULT_VALUE;
```

## Typed Configuration

Consumers of a known configuration namespace should inject its NestJS configuration token directly.

```typescript
@Injectable()
export class ExampleService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}
}
```

Avoid string-based lookups for known namespaces:

```typescript
configService.get('auth.secret');
```

Typed namespace injection makes configuration dependencies explicit and preserves the validated contract.

`ConfigService` should be reserved for cases that genuinely require dynamic access or aggregation across multiple
namespaces.

## Immutability

Bootstrap configuration represents application startup state and should be treated as read-only.

Configuration types should use read-only contracts where practical.

Runtime mutable settings belong to a separate application boundary and must not be modeled as bootstrap configuration.

## Secrets

Secrets must not be hardcoded in source code.

They must enter the application through an external configuration source and pass through the appropriate configuration
boundary.

Secrets must not be exposed through:

- logs;
- exception messages;
- diagnostic responses;
- committed configuration files.

Example environment files may document required variables but must contain only safe placeholder values.

## Rules

1. Use `@nestjs/config` for application configuration registration and dependency injection.
2. Validate runtime configuration with Zod before exposing it to consumers.
3. Organize configuration into cohesive semantic namespaces.
4. Keep configuration with its owning architectural boundary.
5. Isolate `process.env` and other external configuration sources behind configuration boundaries.
6. Build the complete namespace before performing final validation.
7. Fail application startup when required configuration is invalid.
8. Inject known namespaces through their typed configuration tokens.
9. Do not scatter string-based configuration paths throughout application code.
10. Treat bootstrap configuration as read-only.
11. Keep secrets outside source code and diagnostics.
