# Convenciones de API REST

Este documento define las convenciones generales para diseñar Endpoints HTTP RESTful en la aplicación.

Las reglas específicas de contratos, paginación, versionado, OpenAPI, autenticación, autorización y errores se definen en sus documentos correspondientes.

## Recursos y rutas

Las rutas deben representar recursos o colecciones mediante sustantivos estables del dominio.

Utilice:

- minúsculas;
- plural para colecciones;
- `kebab-case` para nombres compuestos.

```text
/users
/payment-methods
/order-items
/users/:id
```

Evite rutas centradas innecesariamente en acciones o detalles de implementación.

```text
/getUsers
/createUser
/paymentMethods
```

Utilice recursos anidados cuando la relación con el padre forme parte relevante del contexto de acceso, evitando anidamiento excesivo.

## GET

`GET` recupera recursos o colecciones y debe mantener semántica safe e idempotente.

```text
GET /users
GET /users/:id
GET /users?status=active&sort=-createdAt
```

Utilice `GET` para consultas que puedan expresarse de forma razonable mediante URI y Query Params.

## QUERY

HTTP `QUERY` se utiliza para consultas safe e idempotentes que requieren un Request Body por su tamaño o complejidad.

```http
QUERY /users
Content-Type: application/json
```

`GET` continúa siendo la opción predeterminada para consultas convencionales.

Utilice `QUERY` cuando `GET` deje de ser una representación práctica. Cuando exista una limitación real del stack para soportar `QUERY`, puede utilizarse temporalmente:

```text
POST /resource/search
```

como fallback de compatibilidad.

La compatibilidad específica de OpenAPI y tooling se define en `openapi.md`.

## POST

`POST` se utiliza para crear recursos o ejecutar operaciones cuya semántica no corresponda a una actualización idempotente sobre un recurso conocido.

```text
POST /users
POST /auth/login
POST /orders/:id/cancel
```

Una creación exitosa debe utilizar normalmente:

```text
201 Created
```

Cuando el recurso creado tenga una URI pública identificable, la Response debe incluir `Location`.

```http
Location: /users/123
```

No utilice rutas de acción cuando un método HTTP estándar represente correctamente la operación.

## PUT

`PUT` representa el reemplazo completo de la representación modificable de un recurso conocido y debe ser idempotente.

```text
PUT /users/:id
```

No utilice `PUT` como actualización parcial.

## PATCH

`PATCH` representa una modificación parcial de un recurso existente.

```text
PATCH /users/:id
```

Los campos omitidos y los campos explícitamente `null` deben conservar la semántica definida por el Request Contract.

Una actualización puede responder `200 OK` cuando devuelve una representación o `204 No Content` cuando no devuelve body.

## DELETE

`DELETE` provoca que un recurso deje de estar disponible bajo su URI según la semántica pública del dominio.

```text
DELETE /users/:id
```

Una eliminación exitosa sin Response Body debe utilizar normalmente:

```text
204 No Content
```

Una Response `204 No Content` no debe incluir body.

## Status Codes

Convención base:

| Situación | Status |
| --- | --- |
| Lectura exitosa | `200 OK` |
| Creación exitosa | `201 Created` |
| Operación exitosa sin body | `204 No Content` |
| Request inválido | `400 Bad Request` |
| No autenticado | `401 Unauthorized` |
| No autorizado | `403 Forbidden` |
| Recurso inexistente | `404 Not Found` |
| Conflicto de estado | `409 Conflict` |
| Rate limit excedido | `429 Too Many Requests` |
| Error interno inesperado | `500 Internal Server Error` |

Los detalles del Error Response se definen en `../architecture/error-handling.md`.

No utilice `200 OK` para representar errores mediante campos dentro del Response Body.

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

Operaciones no idempotentes sensibles a reintentos pueden definir un `Idempotency-Key` cuando el caso de uso lo requiera. No lo aplique globalmente sin necesidad.

## Filtering y sorting

Filtering y sorting deben expresarse mediante contratos públicos explícitos.

No exponga directamente nombres de columnas, propiedades Prisma ni expresiones internas de persistencia.

Los campos permitidos y su semántica deben definirse por Endpoint o por un contrato compartido con owner claro.

La paginación se define en `pagination.md`.

## Reglas

1. Modele rutas alrededor de recursos y colecciones.
2. Utilice plural y `kebab-case` para rutas de recursos.
3. Utilice `GET` para lecturas convencionales y `QUERY` para consultas complejas safe e idempotentes con Request Body.
4. Utilice `POST /resource/search` sólo como fallback cuando el stack no soporte correctamente `QUERY`.
5. Utilice `POST` para creación y operaciones con semántica propia que no correspondan a métodos estándar.
6. Utilice `PUT` para reemplazo completo y `PATCH` para actualización parcial.
7. Utilice `204 No Content` para operaciones exitosas sin Response Body y no incluya body con ese status.
8. Incluya `Location` cuando `POST` cree un recurso públicamente direccionable.
9. Mantenga Status Codes consistentes con la semántica pública de la operación.
10. No exponga detalles de persistencia mediante filtering, sorting o rutas públicas.
11. Mantenga la semántica de idempotencia declarada por cada método y operación.
