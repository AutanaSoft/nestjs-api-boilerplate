# Autorización

Status: Target

Este documento define la estrategia arquitectónica para decidir qué operaciones puede ejecutar un principal autenticado.

La autenticación establece la identidad. La autorización evalúa si esa identidad puede realizar una operación.

La arquitectura de autenticación se define en `authentication.md`.

La representación HTTP de los resultados de autorización se define en `../api/conventions.md`.

## Principio

Una identidad autenticada no debe considerarse automáticamente autorizada.

```text
Authenticated Principal
        ↓
Authorization
        ↓
Allow / Deny
```

La autorización debe resolverse antes de completar una operación protegida.

## Estrategias

La autorización puede utilizar, según la granularidad requerida:

- Roles;
- Permissions;
- Policies;
- resource ownership;
- atributos del principal;
- atributos del recurso.

La arquitectura no requiere una librería específica.

## Roles y Permissions

Los Roles representan agrupaciones amplias de acceso.

Los Permissions representan capacidades específicas.

Cuando se utilicen Permissions, deben seguir nombres estables. La convención preferida es:

```text
<resource>:<action>
```

Cuando Roles y Permissions coexistan, los Roles deben agrupar Permissions y los componentes protegidos deben declarar la capacidad realmente requerida.

## Metadata y Guards

Los requisitos que puedan evaluarse antes de cargar un recurso deben declararse mediante metadata y resolverse con Guards.

```typescript
@RequirePermissions(Permission.ResourceUpdate)
@Patch(':id')
update() {}
```

Los Controllers no deben repetir checks equivalentes de autorización en cada operación.

## Policies y autorización dependiente del recurso

Las decisiones que dependan del recurso deben resolverse mediante Policies o componentes equivalentes.

```text
Principal + Action + Resource
            ↓
          Policy
            ↓
        Allow / Deny
```

Cuando la decisión necesite estado persistido, puede resolverse dentro del caso de uso después de cargar el recurso.

```text
Service
   ↓
Load Resource
   ↓
Policy
   ↓
Continue / Reject
```

No duplique acceso a persistencia en un Guard y posteriormente en el Service únicamente para mantener toda la autorización dentro del Guard.

Los Services y Policies no deben utilizar `HttpException` como representación general de una denegación.

Cuando una decisión de autorización forme parte del caso de uso, utilice un Application Error independiente del transport y deje su traducción al Error Boundary definido en `error-handling.md`.

## Deny by Default

Cuando una operación protegida no pueda demostrar que el principal cumple los requisitos necesarios, debe rechazarse.

```text
Insufficient authorization evidence → Deny
```

## Claims y estado actual

Las claims de autorización incluidas en credentials pueden quedar desactualizadas durante su vigencia.

Mantenga las claims mínimas y utilice estado actual o mecanismos de invalidación cuando los cambios de autorización necesiten efecto inmediato.

El cliente no debe ser una fuente confiable de identidad, Roles, Permissions u ownership mediante Request Body, Query Params, Route Params o Headers arbitrarios.

## Resource Visibility

La autorización puede determinar qué recursos o campos puede observar un principal.

La decisión debe resolverse antes de seleccionar la Response pública.

La serialización no sustituye una decisión de autorización.

Cuando la existencia de un recurso sea información sensible, la Policy puede definir una estrategia de no divulgación. Su representación HTTP pública debe seguir las convenciones de API.

## Reglas

1. Mantenga autenticación y autorización como responsabilidades independientes.
2. Evalúe autorización explícitamente para operaciones protegidas.
3. Utilice Roles, Permissions y Policies según la granularidad requerida.
4. Prefiera Permissions para capacidades específicas y Roles como agrupaciones cuando ambos modelos existan.
5. Utilice metadata y Guards cuando la decisión pueda resolverse antes de cargar el recurso.
6. Utilice Policies para decisiones contextuales o dependientes del recurso.
7. No duplique acceso a persistencia para forzar autorización dependiente del recurso dentro de Guards.
8. Mantenga `HttpException` fuera de Services y Policies como representación general de autorización.
9. Aplique deny by default cuando no exista evidencia suficiente.
10. No confíe en input del cliente como fuente de identidad o autorización.
11. Resuelva autorización antes de seleccionar datos públicos.
12. Delegue la representación HTTP de authentication/authorization failures a las convenciones API.
