# Autorización

Este documento define las convenciones de autorización para controlar qué operaciones puede ejecutar un principal autenticado.

La autenticación determina quién realiza la Request. La autorización determina qué puede hacer ese principal.

## Principio

Una Request autenticada no debe considerarse automáticamente autorizada.

```text
Authentication
      ↓
Authenticated Principal
      ↓
Authorization
      ↓
Allowed Operation
```

La autorización debe ejecutarse antes de completar una operación protegida.

## 401 y 403

Utilice:

- `401 Unauthorized` cuando no pueda establecerse un principal autenticado válido;
- `403 Forbidden` cuando exista un principal válido pero carezca de autorización.

No utilice `401` para representar falta de permisos de un principal correctamente autenticado.

## Estrategias

La autorización puede utilizar, según los requisitos del proyecto:

- Roles;
- Permissions;
- Policies;
- resource ownership;
- atributos del principal o del recurso.

La arquitectura no obliga a utilizar una librería concreta.

## Roles y Permissions

Los Roles representan agrupaciones amplias de acceso.

Los Permissions representan capacidades específicas y, cuando se utilicen, deben seguir nombres estables.

Convención recomendada:

```text
<resource>:<action>
```

```text
users:read
users:create
users:update
users:delete
```

Cuando existan Roles y Permissions, prefiera que los Roles agrupen Permissions y que los Endpoints declaren la capacidad requerida cuando esa sea la regla real.

## Metadata y Guards

Los requisitos de autorización que puedan resolverse antes de cargar el recurso deben declararse mediante metadata y resolverse con Guards.

```typescript
@RequirePermissions(Permission.UsersUpdate)
@Patch(':id')
updateUser() {}
```

Los Controllers no deben repetir checks equivalentes de permisos en cada Endpoint.

Cuando exista autenticación global, los Endpoints públicos deben declararse explícitamente, por ejemplo mediante `@Public()`.

## Policies y autorización dependiente del recurso

Las reglas que dependan del recurso deben resolverse mediante Policies o componentes equivalentes.

```text
Principal + Action + Resource
            ↓
          Policy
            ↓
        Allow / Deny
```

Si una decisión requiere cargar datos persistidos, puede resolverse dentro del caso de uso después de cargar el recurso.

```text
Service
   ↓
Load Resource
   ↓
Policy
   ↓
Continue / Reject
```

No duplique una query en un Guard y posteriormente en el Service sólo para mantener artificialmente toda autorización dentro de Guards.

Los Services y Policies no deben utilizar `HttpException` como representación general de autorización. Cuando una Policy rechace una operación dentro del caso de uso, utilice un Application Error independiente del transport y deje su traducción HTTP al Error Boundary.

## Deny by Default

Cuando una operación protegida no pueda demostrar que el principal cumple los requisitos de autorización, debe rechazarse.

```text
Insufficient authorization evidence → Deny
```

## Claims y estado actual

Roles o Permissions incluidos en tokens pueden quedar desactualizados durante la vida del token.

Mantenga las claims mínimas y utilice estado actual o mecanismos de invalidación cuando los cambios de autorización necesiten efecto inmediato.

El cliente nunca debe definir su propia identidad, Roles, Permissions u ownership mediante Request Body, Query Params, Route Params o Headers arbitrarios.

## Resource visibility

La autorización también puede determinar qué recursos o campos puede observar un principal.

La decisión debe resolverse antes de seleccionar el Response Contract final. La serialización no sustituye una decisión de autorización.

Cuando revelar la existencia de un recurso sea sensible, una Policy puede definir explícitamente una respuesta equivalente a `404 Not Found` en lugar de `403 Forbidden`. Esta excepción debe ser consistente y deliberada.

## Reglas

1. Mantenga autenticación y autorización como responsabilidades independientes.
2. Utilice `401 Unauthorized` cuando no exista un principal válido y `403 Forbidden` cuando un principal válido carezca de autorización.
3. Utilice Roles, Permissions y Policies según la granularidad real requerida.
4. Prefiera Permissions para capacidades específicas y Roles como agrupaciones cuando ambos modelos existan.
5. Declare mediante metadata y Guards la autorización que pueda resolverse antes de cargar un recurso.
6. Declare explícitamente los Endpoints públicos cuando exista protección global.
7. Utilice Policies para reglas contextuales o dependientes del recurso.
8. No duplique acceso a persistencia para forzar autorización dependiente del recurso dentro de Guards.
9. Mantenga `HttpException` fuera de Services y Policies como mecanismo general de autorización.
10. Aplique deny by default cuando no exista evidencia suficiente de autorización.
11. No confíe en input del cliente como fuente de identidad, Roles, Permissions u ownership.
12. Resuelva autorización antes de seleccionar o serializar datos públicos.
