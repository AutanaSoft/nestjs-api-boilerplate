# OpenAPI

Status: Target

Este documento define las convenciones para representar y mantener el contrato público mediante OpenAPI.

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

No mantenga manualmente una segunda definición incompatible de un contrato existente únicamente para generar documentación.

Las estrategias técnicas de validation y serialization se definen en `../architecture/validation.md` y `../architecture/serialization.md`.

## Version

Utilice una versión de OpenAPI capaz de representar todos los métodos HTTP publicados por la API.

Cuando la API exponga `QUERY`, utilice OpenAPI 3.2 y represente la operación mediante los mecanismos definidos por esa versión.

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

Los workarounds requeridos por limitaciones del generator deben permanecer aislados y eliminarse cuando exista soporte nativo equivalente.

## Versioning

La especificación debe reflejar correctamente las rutas y contratos de cada versión publicada.

Las reglas de versionado se definen en `versioning.md`.

## Security

Las operaciones protegidas deben representar sus requisitos de authentication mediante los Security Schemes correspondientes.

La especificación no debe presentar una operación protegida como pública.

## Errors

Las Responses de error deben utilizar el contrato compartido definido en `http-contracts.md`.

No defina un formato paralelo exclusivamente para OpenAPI.

## Operation IDs

Cada operación pública debe tener un `operationId` estable y único.

Un cambio de `operationId` debe tratarse como contractual cuando clientes o tooling externos dependan de él.

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
