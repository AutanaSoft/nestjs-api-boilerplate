# OpenAPI

Status: Target

Este documento define las convenciones para representar y mantener el contrato público mediante
OpenAPI.

La especificación se genera mediante `@nestjs/swagger`.

Los detalles internos de integración no pertenecen a este documento.

## Source of Truth

OpenAPI es una representación del contrato HTTP público, no un owner paralelo.

Debe permanecer consistente con:

- `conventions.md`;
- `http-contracts.md`;
- `pagination.md`;
- `versioning.md`;
- los contratos concretos de cada Feature.

No mantenga manualmente una segunda definición incompatible de un contrato existente únicamente para
generar documentación.

Las estrategias técnicas de validation y serialization se definen en `../architecture/validation.md`
y `../architecture/serialization.md`.

## Exposición operativa

La exposición de OpenAPI es opcional y está deshabilitada de forma predeterminada. Cuando se
habilita, la UI y el documento JSON se publican mediante el namespace `openapi` en rutas operativas
no versionadas y externas a `API_GLOBAL_PREFIX`: `/docs` y `/openapi.json` por defecto. Estas rutas
no son operaciones de la API versionada.

El documento usa exclusivamente `name`, `description` y `version` del namespace `app`. El namespace
`openapi` solo define habilitación y rutas; sus variables, valores predeterminados y restricciones
son propiedad de [configuración de seguridad HTTP](../configuration/http-security.md).

## Fuente de schemas y alcance de publicación

Los schemas de respuesta y entrada se derivan directamente desde sus schemas Zod canónicos mediante
el adaptador OpenAPI compartido, con dirección explícita `output` o `input`. No cree DTOs de
Swagger, clases anotadas ni tipos paralelos para describir un contrato existente.

La generación incluye una lista explícita de módulos de producción publicados. Actualmente incluye
`HealthModule`; excluye el catch-all de rutas no encontradas y todos los controllers o fixtures
exclusivos de E2E. Un Feature que publique un controller debe añadir su módulo, decoradores y
pruebas de documento en la misma unidad de trabajo.

## Version

Utilice una versión de OpenAPI capaz de representar todos los métodos HTTP publicados por la API.

Cuando la API exponga `QUERY`, utilice OpenAPI 3.2 y represente la operación mediante los mecanismos
definidos por esa versión.

## Operations

Todas las operaciones HTTP públicas deben aparecer en la especificación.

Esto incluye, cuando estén expuestas:

```text
GET
QUERY
POST
PUT
PATCH
DELETE
```

Los workarounds requeridos por limitaciones del generator deben permanecer aislados y eliminarse
cuando exista soporte nativo equivalente.

## Versioning

La especificación debe reflejar correctamente las rutas y contratos de cada versión publicada.

Las reglas de versionado se definen en `versioning.md`.

## Security

Las operaciones protegidas deben representar sus requisitos de authentication mediante los Security
Schemes correspondientes.

La especificación no debe presentar una operación protegida como pública.

## Errors

Las Responses de error deben utilizar el contrato compartido definido en `http-contracts.md`.

No defina un formato paralelo exclusivamente para OpenAPI. Las operaciones de health declaran
exactamente `200`, `503` y `500`: `200` y `503` usan el schema canónico de health y `500` usa el
schema compartido de Error Response solo para fallos inesperados.

## Operation IDs

Cada operación pública debe tener un `operationId` estable y único. Las operaciones actuales de
health usan `healthLive` y `healthReady`.

Un cambio de `operationId` debe tratarse como contractual cuando clientes o tooling externos
dependan de él.

## Reglas

1. Genere la especificación mediante `@nestjs/swagger`.
2. Trate OpenAPI como representación del contrato público, no como un owner paralelo.
3. Mantenga los Schemas OpenAPI alineados con los contratos canónicos.
4. No duplique manualmente contratos existentes únicamente para documentación.
5. Utilice OpenAPI 3.2 cuando sea necesario representar `QUERY`.
6. Documente todas las operaciones HTTP públicas.
7. Mantenga workarounds de tooling aislados y temporales.
8. Mantenga OpenAPI consistente con el versionado publicado.
9. Represente correctamente los requisitos de authentication.
10. Reutilice el Error Response definido en `http-contracts.md`.
11. Mantenga `operationId` estable y único.
12. Mantenga la especificación alineada con el comportamiento observable de la API.
13. Mantenga UI y JSON fuera del prefijo global y del versionado URI.
14. Derive schemas desde sus owners canónicos y limite el documento a módulos de producción
    publicados.
