# Versionado de API

Este documento define la estrategia de versionado de la API HTTP.

La estrategia estándar es **URI Versioning**.

## Convención

Las rutas versionadas utilizan:

```text
/api/v1
/api/v2
```

NestJS debe configurarse con:

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

La versión inicial de la API es:

```text
v1
```

## Scope

El versionado aplica al contrato HTTP público.

Incluye cambios en:

- rutas;
- Request Contracts;
- Response Contracts;
- Status Codes;
- Headers públicos;
- semántica observable de Endpoints.

Los cambios internos de implementación no requieren una nueva versión mientras el contrato público permanezca compatible.

## Breaking Changes

Un cambio requiere una nueva versión cuando rompe compatibilidad con clientes existentes.

Ejemplos:

- eliminar o renombrar un Endpoint;
- cambiar un método HTTP;
- eliminar o renombrar campos públicos;
- cambiar el tipo o significado de un campo;
- convertir un campo opcional en requerido;
- cambiar Status Codes con semántica contractual;
- modificar de forma incompatible pagination, filtering o sorting;
- cambiar requisitos de autenticación o autorización de forma incompatible con el contrato existente.

Agregar capacidades compatibles no requiere automáticamente una nueva versión.

## Versiones

Las versiones se expresan mediante números enteros:

```text
v1
v2
v3
```

No utilice versiones semánticas como:

```text
v1.2.3
```

en las rutas HTTP.

Los cambios compatibles evolucionan dentro de la misma versión.

Los breaking changes crean una nueva versión mayor de la API.

## Coexistencia

Cuando se introduzca una nueva versión, la versión anterior puede mantenerse activa durante un periodo de transición.

```text
/api/v1/users
/api/v2/users
```

La implementación debe compartir lógica de aplicación cuando sea posible y evitar duplicar Services o Repositories únicamente por diferencias de transporte.

Las diferencias entre versiones deben mantenerse principalmente en el HTTP Boundary.

## Deprecation

Una versión o Endpoint no debe eliminarse inmediatamente después de publicar su reemplazo.

La deprecation debe:

- estar documentada;
- identificar la alternativa recomendada;
- indicar cuándo dejará de recibir soporte cuando esa fecha sea conocida.

Los mecanismos concretos de comunicación de deprecation pueden definirse según las necesidades del proyecto.

## VERSION_NEUTRAL

`VERSION_NEUTRAL` debe reservarse para Endpoints que realmente deban permanecer fuera del versionado público.

No debe utilizarse para evitar asignar una versión a Controllers o Endpoints normales.

## Reglas

1. Utilice URI Versioning como estrategia estándar.
2. Utilice `/api/v1`, `/api/v2`, etc.
3. Utilice `v1` como versión inicial.
4. Utilice números enteros para las versiones públicas.
5. Cree una nueva versión únicamente para breaking changes del contrato HTTP.
6. Mantenga cambios compatibles dentro de la versión existente.
7. Permita coexistencia temporal entre versiones cuando sea necesario.
8. Mantenga las diferencias entre versiones principalmente en el HTTP Boundary.
9. No duplique lógica de aplicación únicamente por diferencias de versión HTTP.
10. Documente la deprecation antes de retirar una versión pública.
11. Utilice `VERSION_NEUTRAL` sólo para Endpoints que realmente no deban formar parte del versionado.
