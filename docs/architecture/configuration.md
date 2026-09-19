# Configuración

Status: Implemented

Este documento define la arquitectura de configuración de la aplicación.

El proyecto utiliza `@nestjs/config` para registration e injection y Zod para runtime validation.

## Configuration Boundary

Las external configuration sources deben permanecer aisladas de los consumidores de aplicación.

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

Los componentes de aplicación no deben acceder directamente a `process.env` ni a otros external configuration providers.

## Namespaces

La aplicación registra estos namespaces cohesivos desde `src/config/`:

```text
app       Environment and public application identity
api       Public URI prefix and HTTP API version bootstrap configuration
http      Server port and trusted proxy hops
cors      Complete browser cross-origin policy
database  PostgreSQL connection URL for Prisma infrastructure
rateLimit Global in-memory NestJS Throttler limits
openapi   Conditional OpenAPI exposure and operational routes
shutdown  Process shutdown deadline
```

Cada namespace posee sus external inputs, defaults, normalization, derived values, validation y final read-only
configuration type. `app` es propietario de `NODE_ENV` y los metadatos públicos; `api` es propietario de
`API_GLOBAL_PREFIX`, mientras que la versión HTTP inicial es una constante del código; `cors` usa el entorno únicamente
para aplicar su requisito de allowlist explícita en producción. `database` es propietario de `DATABASE_URL`, la valida
como URL de PostgreSQL y la expone a la infraestructura Prisma mediante su token tipado. `openapi` es propietario
únicamente de la habilitación condicional y de las rutas operativas de UI/documento; no posee metadata, contratos ni
lógica de generación.

Los nombres deben ser semánticos, cortos y estables. La configuración específica de un Feature o infraestructura debe
permanecer junto a su owner cuando exista uno más claro. No centralice configuración únicamente por conveniencia
técnica.

## Configuration Factories

Cada namespace debe construir su configuración completa antes de exponerla. La secuencia es:

```text
defaults
   ↓
external overrides
   ↓
normalization
   ↓
derived values
   ↓
validation
```

El namespace debe registrarse mediante `registerAs` y exponer únicamente configuración validada. Cada application
context registra solamente los namespaces que requiere. Los consumers de un namespace conocido inyectan `config.KEY` con
`ConfigType<typeof config>`; no usan string-based lookups ni `ConfigService`.

## Validación e inmutabilidad

La configuración inválida requerida por la aplicación debe provocar un fallo durante startup. Los consumidores no deben
repetir validaciones que pertenecen al configuration namespace. Los external values deben tratarse como untrusted input
y normalizarse antes de formar la configuración final.

La startup configuration debe tratarse como read-only. Los mutable runtime settings pertenecen a una responsabilidad
distinta y no deben modelarse como startup configuration.

## Secrets

Los secrets no deben hardcodearse ni exponerse mediante:

- logs;
- errors;
- diagnostic responses;
- archivos versionados.

Deben ingresar mediante una external configuration source y atravesar el configuration boundary correspondiente.

## Owners operativos

Los valores concretos, defaults y restricciones operativas de `api`, `http`, `cors`, `rateLimit` y `openapi` se
documentan en `../configuration/http-security.md`. La configuración operativa de `database` pertenece a
`../configuration/database.md`, y la del namespace transversal `shutdown` pertenece a
`../configuration/process-lifecycle.md`.

`AppModule` registra `openapi`; el bootstrap obtiene su valor tipado y lo entrega a la infraestructura OpenAPI después
del bootstrap HTTP común. Las reglas del contrato URI pertenecen exclusivamente a `../api/versioning.md`. Estos
documentos no sustituyen esta estrategia arquitectónica; mantienen la referencia runtime y el contrato público,
respectivamente.

## Reglas

1. Utilice `@nestjs/config` para registration e injection.
2. Valide runtime configuration con Zod antes de exponerla.
3. Organice configuración mediante namespaces cohesivos.
4. Mantenga cada configuración junto al boundary que la posee.
5. Aísle external configuration sources detrás de configuration factories.
6. Construya y valide el namespace completo antes de exponerlo.
7. Haga fallar startup cuando la configuración requerida sea inválida.
8. Prefiera typed configuration injection.
9. Trate startup configuration como read-only.
10. Mantenga secrets fuera del source code y diagnostics.
