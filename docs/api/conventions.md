# Convenciones de API REST

Status: Target

Este documento define las convenciones generales del contrato HTTP público de la API.

Los contratos, paginación, versionado y OpenAPI tienen documentos owners específicos dentro de `docs/api/`.

## Recursos y rutas

Las rutas deben representar recursos o colecciones mediante nombres estables.

Utilice:

- minúsculas;
- plural para colecciones;
- `kebab-case` para nombres compuestos.

```text
/resources
/payment-methods
/resources/:id
```

Evite rutas centradas innecesariamente en acciones o detalles internos.

Los recursos anidados deben utilizarse únicamente cuando la relación con el recurso padre forme parte relevante del
contexto público.

## GET

`GET` se utiliza para recuperar recursos o colecciones y mantiene semántica safe e idempotent.

Utilice Query Params cuando una consulta pueda representarse razonablemente mediante la URI.

## QUERY

`QUERY` se utiliza para consultas safe e idempotent cuyo input requiere Request Content.

`GET` continúa siendo la opción predeterminada para consultas convencionales.

Utilice `QUERY` cuando representar el input mediante la URI deje de ser práctico.

Cuando exista una limitación real de compatibilidad del stack, puede utilizarse temporalmente:

```text
POST /resource/search
```

como fallback explícito.

La representación OpenAPI de `QUERY` se define en `openapi.md`.

## POST

`POST` se utiliza para crear recursos o ejecutar operaciones cuya semántica no corresponda a otro método estándar.

Una creación exitosa utiliza normalmente `201 Created`.

Cuando el recurso creado tenga una URI pública identificable, la Response debe incluir `Location`.

## PUT

`PUT` representa el reemplazo completo de la representación modificable de un recurso conocido y debe ser idempotent.

No utilice `PUT` para actualizaciones parciales.

## PATCH

`PATCH` representa una modificación parcial.

La semántica de campos omitidos y valores `null` pertenece al Request Contract correspondiente.

Una actualización puede utilizar:

- `200 OK` cuando devuelve una representación;
- `204 No Content` cuando no devuelve body.

## DELETE

`DELETE` provoca que el recurso deje de estar disponible bajo su URI según la semántica pública correspondiente.

Una operación exitosa sin body utiliza normalmente `204 No Content`.

Una Response `204 No Content` no debe contener body.

## Status Codes

Convención base:

| Situación                              | Status                      |
| -------------------------------------- | --------------------------- |
| Lectura exitosa                        | `200 OK`                    |
| Creación exitosa                       | `201 Created`               |
| Operación exitosa sin body             | `204 No Content`            |
| Request inválido                       | `400 Bad Request`           |
| Principal no autenticado               | `401 Unauthorized`          |
| Principal autenticado sin autorización | `403 Forbidden`             |
| Recurso no disponible                  | `404 Not Found`             |
| Conflicto de estado                    | `409 Conflict`              |
| Rate limit excedido                    | `429 Too Many Requests`     |
| Error interno inesperado               | `500 Internal Server Error` |

No utilice `200 OK` para representar errores mediante campos dentro del Response Body.

La forma pública del Error Response se define en `http-contracts.md`.

## Resource Visibility

Cuando revelar la existencia de un recurso sea sensible, una política de autorización puede requerir una Response
equivalente a `404 Not Found` en lugar de `403 Forbidden`.

Esta excepción debe ser deliberada y consistente para el contrato correspondiente.

La estrategia interna de autorización se define en `../architecture/authorization.md`.

## Idempotencia

La semántica general es:

```text
GET     safe + idempotent
QUERY   safe + idempotent
PUT     idempotent
DELETE  idempotent en el estado intencional
POST    no necesariamente idempotent
PATCH   depende de la operación
```

Operaciones no idempotentes sensibles a reintentos pueden definir un `Idempotency-Key` cuando su contrato lo requiera.

No lo aplique globalmente sin necesidad.

## Filtering y Sorting

Filtering y sorting deben definirse mediante contratos públicos explícitos.

No exponga nombres de columnas, propiedades del ORM ni expresiones internas de persistencia.

Los campos permitidos y su semántica pertenecen al contrato correspondiente.

La paginación se define en `pagination.md`.

## Reglas

1. Modele rutas alrededor de recursos y colecciones.
2. Utilice plural y `kebab-case` para rutas de recursos.
3. Utilice `GET` para consultas convencionales.
4. Utilice `QUERY` para consultas safe e idempotent que requieran Request Content.
5. Utilice fallbacks basados en `POST` únicamente por necesidades explícitas de compatibilidad.
6. Utilice `PUT` para reemplazo completo y `PATCH` para actualización parcial.
7. Utilice `204 No Content` únicamente sin Response Body.
8. Incluya `Location` cuando una creación produzca un recurso públicamente direccionable.
9. Mantenga Status Codes consistentes con la semántica pública.
10. Mantenga Error Responses bajo `http-contracts.md`.
11. No exponga detalles de persistencia mediante la API pública.
12. Mantenga explícita la semántica de idempotencia de cada operación.
