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

La configuración debe organizarse mediante namespaces cohesivos, por ejemplo:

```text
http
database
auth
```

Cada namespace posee:

- external inputs;
- defaults;
- normalization;
- derived values;
- validation;
- final configuration type.

Los nombres deben ser semánticos, cortos y estables.

## Ownership

Cada configuración pertenece al boundary que configura.

La configuración global puede residir en:

```text
src/config/
```

La configuración específica de un Feature o infraestructura debe permanecer junto a su owner cuando exista uno más
claro.

No centralice configuración únicamente por conveniencia técnica.

## Configuration Factories

Cada namespace debe construir su configuración completa antes de exponerla.

La secuencia es:

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

El namespace debe registrarse mediante `registerAs` y exponer únicamente configuración validada.

## Validación

La configuración inválida requerida por la aplicación debe provocar un fallo durante startup.

Los consumidores no deben repetir validaciones que pertenecen al configuration namespace.

Los external values deben tratarse como untrusted input y normalizarse antes de formar la configuración final.

## Typed Injection

Los consumidores de un namespace conocido deben inyectar su typed configuration token.

Evite dispersar string-based configuration lookups por la aplicación.

`ConfigService` debe reservarse para casos que realmente requieran acceso dinámico o agregación entre namespaces.

## Inmutabilidad

La startup configuration debe tratarse como read-only.

Los mutable runtime settings pertenecen a una responsabilidad distinta y no deben modelarse como startup configuration.

## Secrets

Los secrets no deben hardcodearse ni exponerse mediante:

- logs;
- errors;
- diagnostic responses;
- archivos versionados.

Deben ingresar mediante una external configuration source y atravesar el configuration boundary correspondiente.

## Configuración HTTP

Los valores concretos, defaults y restricciones operativas del namespace HTTP se documentan en
`../configuration/http-security.md`.

Ese documento no sustituye esta estrategia arquitectónica; mantiene la referencia de configuración runtime concreta.

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
