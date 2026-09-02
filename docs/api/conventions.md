# Convenciones de API REST

Este documento define las convenciones generales para diseñar Endpoints HTTP RESTful en la aplicación.

Estas convenciones establecen cómo representar recursos, seleccionar métodos HTTP, utilizar Status Codes, diseñar rutas y mantener una semántica consistente entre Features.

Las reglas de contratos HTTP, validación, serialización, autenticación, autorización y manejo de errores se definen en sus documentos correspondientes.

## Recursos

Las rutas HTTP deben representar recursos o colecciones de recursos.

Prefiera sustantivos que describan entidades o capacidades del dominio.

```text
/users
/orders
/products
```

Evite rutas centradas innecesariamente en acciones:

```text
/getUsers
/createUser
/deleteProduct
```

El método HTTP ya expresa la operación cuando esta corresponde a una operación REST estándar.

```text
GET    /users
POST   /users
GET    /users/:id
PATCH  /users/:id
DELETE /users/:id
```

## Naming de rutas

Los nombres de recursos deben:

- utilizar minúsculas;
- utilizar plural para colecciones;
- ser estables;
- representar conceptos del dominio;
- evitar nombres dependientes de implementación.

Prefiera:

```text
/users
/payment-methods
/order-items
```

Evite:

```text
/user
/paymentMethods
/order_items
```

Para recursos compuestos por varias palabras, utilice `kebab-case`.

## Colecciones y recursos individuales

Una colección representa múltiples recursos:

```text
/users
```

Un recurso individual se identifica bajo su colección:

```text
/users/:id
```

La estructura debe conservar esta relación cuando sea posible.

```text
GET /users
GET /users/:id
```

No utilice rutas distintas para representar arbitrariamente operaciones equivalentes sobre el mismo recurso.

## Recursos anidados

Utilice rutas anidadas cuando la relación con el recurso padre forme parte importante de la identidad o del contexto de acceso.

Por ejemplo:

```text
GET /users/:userId/orders
```

Evite niveles excesivos de anidamiento.

```text
/users/:userId/orders/:orderId/items/:itemId/comments/:commentId
```

Cuando un recurso tenga identidad propia y pueda tratarse independientemente, prefiera una ruta directa.

```text
/order-items/:id
```

La estructura de rutas no debe reproducir automáticamente todas las relaciones de la base de datos.

## GET

`GET` recupera una representación de uno o varios recursos.

Ejemplos:

```text
GET /users
GET /users/:id
```

Una operación `GET` no debe modificar intencionalmente el estado persistente de la aplicación.

El resultado exitoso normalmente utiliza:

```text
200 OK
```

Un recurso individual inexistente normalmente produce:

```text
404 Not Found
```

según las reglas definidas en `error-handling.md`.

Las consultas simples deben continuar utilizando `GET` y Query Params cuando puedan representarse de forma clara y razonable.

Por ejemplo:

```text
GET /users?status=active&sort=-createdAt
```

## HTTP QUERY — RFC 10008

RFC 10008 estandariza el método HTTP `QUERY` para realizar consultas con Request Body manteniendo semántica safe e idempotente.

`QUERY` está orientado especialmente a operaciones de lectura donde `GET` no resulta adecuado para transportar filtros, agregaciones u otras estructuras de consulta complejas.

Ejemplo tradicional:

```http
POST /operations/search
Content-Type: application/json
```

Equivalente mediante `QUERY`:

```http
QUERY /operations
Content-Type: application/json
```

### Semántica de QUERY

`QUERY` puede utilizarse para operaciones que:

- únicamente consultan información;
- no modifican intencionalmente el estado del sistema;
- son safe;
- son idempotentes;
- requieren un Request Body para expresar filtros, sorting, agregaciones, pagination u otras consultas complejas.

`QUERY` no sustituye a `GET` para recuperación convencional de recursos.

Por ejemplo:

```http
GET /users/:id
```

continúa siendo preferible a:

```http
QUERY /users/:id
```

cuando no existe necesidad de un Request Body de consulta.

### Soporte en NestJS

NestJS 12 soporta el método HTTP `QUERY`.

Debido a que `@Query()` ya representa Query Params, el decorator HTTP correspondiente es:

```typescript
@QueryMethod()
```

Ejemplo:

```typescript
@QueryMethod()
search(
  @Body({ schema: searchOperationsSchema })
  query: SearchOperationsInput,
) {
  return this.operationsService.search(query);
}
```

El método HTTP pertenece al transport boundary y no debe modificar la lógica del caso de uso.

```text
Controller
    ↓
Search Contract
    ↓
Service
    ↓
Repository
```

La lógica de consulta debe permanecer independiente del mecanismo HTTP concreto.

### Estado del tooling

Aunque NestJS soporta `QUERY`, la compatibilidad completa del stack debe verificarse antes de convertirlo en el mecanismo predeterminado para consultas complejas.

Deben comprobarse como mínimo:

- `@nestjs/swagger`;
- versión OpenAPI generada por el proyecto;
- Swagger UI;
- client generators;
- reverse proxies;
- API gateways;
- CDN/WAF;
- configuración CORS;
- caching;
- observabilidad y tooling intermedio.

El soporte del framework por sí solo no garantiza compatibilidad end-to-end.

### Convención actual

`GET` continúa siendo el método predeterminado para consultas convencionales.

```text
GET /users/:id
GET /users?status=active
```

Cuando una consulta requiera un Request Body complejo, existen dos estrategias:

```text
QUERY /resource
```

cuando todo el stack utilizado soporte correctamente RFC 10008,

o temporalmente:

```text
POST /resource/search
```

cuando exista una limitación real de tooling o infraestructura.

`POST /resource/search` debe considerarse un fallback de compatibilidad para una consulta safe e idempotente, no la primera opción cuando `QUERY` esté completamente soportado por el stack.

### Regla de diseño para consultas

No utilice `POST` para consultas simples que puedan representarse correctamente mediante `GET`.

No utilice `QUERY` cuando la consulta pueda expresarse razonablemente mediante Query Params convencionales.

Considere `QUERY` cuando:

```text
GET + Query Params
```

deje de ser una representación práctica debido al tamaño, estructura o complejidad del contrato.

La lógica de negocio no debe depender de si el transport utiliza:

```text
POST /operations/search
```

o:

```text
QUERY /operations
```

Una migración entre ambos debe quedar aislada principalmente al Controller y al contrato HTTP.

### CORS y QUERY

`QUERY` no es un CORS-safelisted method.

Las Requests cross-origin desde browsers requieren preflight `OPTIONS`.

Cuando la API permita `QUERY` desde browser clients, el método debe incluirse explícitamente entre los métodos permitidos por la configuración CORS.

### Caching y QUERY

Las Responses de `QUERY` pueden participar en mecanismos de caching cuando el stack utilizado lo soporte correctamente.

La cache key debe considerar el contenido del Request además de la URI y demás metadata relevante.

No debe asumirse que caches, reverse proxies o CDN existentes implementan correctamente esta semántica.

La compatibilidad debe verificarse antes de depender del caching de `QUERY` en producción.

## POST

`POST` se utiliza normalmente para crear un nuevo recurso dentro de una colección o ejecutar una operación cuya semántica no corresponda a una actualización idempotente de un recurso conocido.

Ejemplo de creación:

```text
POST /users
```

Una creación exitosa debe utilizar normalmente:

```text
201 Created
```

Cuando el recurso creado tenga una URI pública identificable, la Response debe incluir:

```http
Location: /users/<id>
```

El Response Body puede incluir la representación creada cuando forme parte del contrato del Endpoint.

```text
POST /users
    ↓
201 Created
Location: /users/<id>
```

No utilice `200 OK` por defecto para operaciones que realmente representan creación de un recurso.

## POST para operaciones no CRUD

No toda operación del dominio puede representarse correctamente como CRUD sobre un recurso existente.

Por ejemplo:

```text
POST /auth/login
POST /orders/:id/cancel
POST /payments/:id/refund
```

pueden ser apropiadas cuando representan comandos o workflows con semántica propia.

Estas rutas deben utilizarse de forma deliberada y no como sustituto general de métodos HTTP estándar.

Evite:

```text
POST /users/:id/update
```

cuando:

```text
PATCH /users/:id
```

represente correctamente la operación.

Para consultas complejas safe e idempotentes, siga primero la convención `GET` / `QUERY` antes de utilizar `POST /resource/search`.

## PUT

`PUT` representa el reemplazo completo de la representación modificable de un recurso en una URI conocida.

Ejemplo:

```text
PUT /users/:id
```

El contrato de `PUT` debe representar una sustitución completa de los campos modificables definidos por el recurso.

No utilice `PUT` como sinónimo de actualización parcial.

`PUT` debe ser idempotente:

```text
same PUT repeated
        ↓
same intended resource state
```

Cuando la aplicación no necesite reemplazo completo, no es obligatorio exponer `PUT`.

## PATCH

`PATCH` representa una modificación parcial de un recurso existente.

Ejemplo:

```text
PATCH /users/:id
```

Los campos omitidos deben conservar la semántica definida en el Request Schema.

Especialmente:

```text
property omitted
```

y:

```text
property: null
```

no deben considerarse equivalentes salvo que el contrato lo establezca.

Una actualización exitosa puede responder:

```text
200 OK
```

cuando devuelve la representación actualizada.

Puede utilizar:

```text
204 No Content
```

cuando la operación tenga éxito y no exista Response Body.

La aplicación debe utilizar una convención consistente para Endpoints equivalentes.

## DELETE

`DELETE` elimina un recurso o provoca que deje de estar disponible bajo la URI correspondiente, según la semántica del dominio.

Ejemplo:

```text
DELETE /users/:id
```

Una eliminación exitosa sin Response Body debe utilizar normalmente:

```text
204 No Content
```

No envíe un Response Body con `204 No Content`.

Si el dominio utiliza soft delete, archive o desactivación, la API no debe afirmar necesariamente que el registro físico fue eliminado.

La semántica HTTP describe el recurso público, no la implementación de persistencia.

## Status Codes

Los Endpoints deben usar Status Codes según la semántica pública de la operación.

Convención base:

| Situación                  | Status                      |
| -------------------------- | --------------------------- |
| Lectura exitosa            | `200 OK`                    |
| Creación exitosa           | `201 Created`               |
| Operación exitosa sin body | `204 No Content`            |
| Request inválido           | `400 Bad Request`           |
| No autenticado             | `401 Unauthorized`          |
| No autorizado              | `403 Forbidden`             |
| Recurso inexistente        | `404 Not Found`             |
| Conflicto de estado        | `409 Conflict`              |
| Rate limit excedido        | `429 Too Many Requests`     |
| Error interno inesperado   | `500 Internal Server Error` |

Los detalles de errores se rigen por `error-handling.md`.

No utilice `200 OK` para comunicar errores mediante un campo dentro del Response Body.

## Status Codes explícitos

Aunque NestJS proporciona defaults, el contrato del Endpoint debe ser deliberado.

NestJS utiliza `200` normalmente y `201` por defecto en `POST`; `@HttpCode(...)` permite declarar otro status cuando sea necesario.

Los Endpoints deben evitar depender accidentalmente de defaults cuando su semántica requiera otro status.

Por ejemplo:

```typescript
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
async remove() {}
```

## Response Body y 204

Un Endpoint que responde:

```text
204 No Content
```

no debe devolver contenido.

Prefiera:

```typescript
@HttpCode(HttpStatus.NO_CONTENT)
async remove(): Promise<void> {
  await this.usersService.remove(...);
}
```

en lugar de retornar una representación que será descartada o contradiga la semántica de `204`.

## Location

Cuando `POST` cree un recurso direccionable, la Response debe incluir `Location`.

```http
HTTP/1.1 201 Created
Location: /users/123
```

`Location` debe identificar la URI pública del recurso y no una ruta interna de infraestructura.

## Idempotencia

Una operación es idempotente cuando repetir la misma Request produce el mismo efecto intencional sobre el estado del recurso.

En general:

```text
GET     safe + idempotent
QUERY   safe + idempotent
PUT     idempotent
DELETE  idempotent in intended state
POST    not necessarily idempotent
PATCH   depends on operation semantics
```

No dependa únicamente del método HTTP para garantizar idempotencia.

La implementación debe respetar la semántica declarada.

## Idempotency Keys

Operaciones `POST` sensibles a reintentos pueden requerir `Idempotency-Key`.

Ejemplos:

- creación de pagos;
- generación de órdenes;
- operaciones financieras;
- comandos externos que no deben duplicarse.

Una política de Idempotency Key debe definir:

- scope;
- lifetime;
- almacenamiento;
- equivalencia de Request;
- comportamiento ante repetición;
- conflicto cuando una misma key se reutiliza con otro payload.

No implemente `Idempotency-Key` globalmente para todos los Endpoints si no existe una necesidad real.

## Controllers

Los Controllers definen la superficie HTTP.

Son responsables de:

- routing;
- decorators HTTP;
- Request Schemas;
- Response Schemas;
- Status Codes;
- Headers;
- delegación a Services.

No deben contener:

- queries ORM;
- lógica de negocio sustancial;
- workflows complejos;
- reglas de autorización dependientes de recursos cuando correspondan al caso de uso.

La estructura general continúa siendo:

```text
HTTP
 ↓
Controller
 ↓
Service
 ↓
Repository
```

## Response handling de NestJS

Prefiera el manejo estándar de Responses de NestJS.

Un Controller debe normalmente retornar el valor y permitir que NestJS y los Interceptors configurados construyan la Response.

Evite inyectar directamente:

```typescript
@Res()
```

para manejo normal de Responses.

El manejo específico del adapter puede desactivar o alterar partes del pipeline estándar de NestJS.

Utilice acceso directo a la Response únicamente cuando exista una necesidad de transporte concreta que no pueda resolverse mediante decorators, Interceptors u otras capacidades estándar.

## Query Params

Los Query Params se utilizan para modificar la representación de una colección o búsqueda sin convertir cada combinación en una nueva ruta.

Ejemplos:

```text
GET /users?status=active
GET /users?sort=createdAt
GET /users?limit=20
```

Todo Query Param debe:

- estar definido por un Request Schema;
- ser validado;
- tener semántica documentada;
- tener límites explícitos cuando pueda afectar consumo de recursos.

No convierta Query Params arbitrarios en objetos Prisma `where`, `orderBy` o equivalentes.

## Filtering

Los filtros deben exponer únicamente campos y operadores definidos por el contrato público.

Ejemplo:

```text
GET /users?status=active
```

No permita que el cliente construya directamente expresiones de persistencia.

Evite contratos equivalentes a:

```json
{
  "where": {
    "someInternalColumn": {
      "contains": "..."
    }
  }
}
```

salvo que exista una API de consulta explícitamente diseñada con esa semántica.

Los mismos principios aplican a Request Bodies utilizados con `QUERY`.

## Sorting

El ordenamiento debe aceptar únicamente campos públicos permitidos.

Por ejemplo:

```text
GET /users?sort=createdAt
GET /users?sort=-createdAt
```

La sintaxis concreta debe definirse de manera consistente.

Un campo no debe ser sortable únicamente porque exista como columna en la base de datos.

Cuando `QUERY` utilice un contrato estructurado de sorting, los campos permitidos deben seguir siendo explícitos y públicos.

## Pagination

Las colecciones que puedan crecer significativamente deben estar paginadas.

La estrategia de pagination se define en `pagination.md`.

Los Endpoints no deben inventar estructuras de pagination diferentes por Feature.

La misma convención debe poder utilizarse tanto desde `GET` como desde `QUERY` cuando corresponda.

## Search

Una búsqueda simple debe representarse mediante Query Params cuando resulte razonable.

```text
GET /users?search=alice
```

Cuando una búsqueda requiera una estructura compleja que no pueda representarse adecuadamente mediante Query Params, prefiera:

```text
QUERY /users
```

si el stack completo lo soporta.

Cuando alguna parte necesaria del stack no soporte todavía `QUERY`, puede utilizarse temporalmente:

```text
POST /users/search
```

El Search Contract y la lógica de aplicación deben mantenerse independientes del método HTTP para facilitar una migración posterior.

La ruta y el contrato no deben reflejar detalles del motor de búsqueda o de persistencia.

## Bulk Operations

Las operaciones sobre múltiples recursos deben tener contratos explícitos.

Por ejemplo:

```text
POST /users/bulk
```

o un recurso específico de operación cuando la semántica lo requiera.

No sobrecargue:

```text
PATCH /users
```

con semánticas ambiguas entre actualización de colección y actualización masiva sin un contrato claro.

Las Bulk Operations deben definir:

- atomicidad;
- partial failure;
- Error Response;
- límites máximos;
- idempotencia cuando corresponda.

## Acciones sobre recursos

Cuando una operación no pueda modelarse adecuadamente como actualización de propiedades, puede exponerse como subrecurso o comando.

Por ejemplo:

```text
POST /orders/:id/cancellation
```

o:

```text
POST /orders/:id/cancel
```

La elección entre recurso nominal y acción debe ser consistente dentro de la API.

Prefiera modelar un estado o recurso cuando exista una entidad clara.

Utilice verbos en rutas sólo cuando representen una operación del dominio que no encaje razonablemente en CRUD.

## No reflejar el ORM

Las rutas y contratos HTTP no deben derivarse automáticamente del Prisma Schema.

Una tabla o relation no implica necesariamente un recurso público.

Una columna no implica automáticamente:

- filtro;
- campo sortable;
- campo writable;
- campo visible;
- Route Param.

La API representa capacidades públicas de la aplicación, no la estructura física de la base de datos.

Esto también aplica a contratos complejos utilizados mediante `QUERY`.

## Consistencia entre Features

Features equivalentes deben utilizar la misma semántica.

Por ejemplo, no defina:

```text
DELETE /users/:id → 204
DELETE /orders/:id → 200 { success: true }
DELETE /products/:id → 201
```

sin una razón contractual explícita.

Tampoco mezcle arbitrariamente:

```text
GET /users/search
POST /orders/search
QUERY /products
```

para capacidades equivalentes sin considerar la complejidad real de sus contratos y compatibilidad del stack.

La consistencia reduce decisiones arbitrarias para clientes y developers.

## OpenAPI

Los Endpoints públicos deben poder representarse mediante OpenAPI.

Los contratos deben describir:

- método;
- path;
- Request Schema;
- Response Schema;
- Status Codes;
- Headers relevantes;
- requisitos de autenticación;
- errores públicos.

La estrategia concreta de generación y validación OpenAPI se define en `openapi.md`.

Para `QUERY`, la representación OpenAPI debe seguir las capacidades de la versión de OpenAPI utilizada y del tooling disponible.

OpenAPI 3.0 y 3.1 no poseen una operación `query` estándar dentro de un Path Item.

OpenAPI 3.2 permite representar métodos HTTP adicionales mediante mecanismos específicos para additional operations.

El soporte efectivo debe verificarse en:

- `@nestjs/swagger`;
- Swagger UI;
- client generators;
- validadores OpenAPI utilizados por el proyecto.

Cuando el tooling requerido no pueda representar correctamente `QUERY`, puede mantenerse temporalmente `POST /resource/search`.

## Testing

Los Unit Tests deben enfocarse en lógica de aplicación y no en repetir que decorators de NestJS funcionan.

Los E2E Tests deben verificar la semántica HTTP observable, incluyendo cuando corresponda:

- método y ruta;
- Status Code;
- Response Contract;
- `Location`;
- Query Params;
- Request Body de `QUERY`;
- filtering;
- sorting;
- comportamiento de métodos no autorizados;
- ausencia de side effects en `GET`;
- ausencia de side effects en `QUERY`;
- idempotencia de operaciones críticas.

Cuando se utilice `QUERY`, los E2E Tests deben verificar también que la Request atraviese correctamente el stack HTTP real utilizado por producción.

Los tests deben seguir las convenciones definidas en `testing.md` y `e2e-testing.md`.

## Reglas

1. Modele las rutas principalmente alrededor de recursos y colecciones.
2. Utilice nombres de recursos en plural y `kebab-case`.
3. Utilice los métodos HTTP según su semántica, no como simples aliases de acciones.
4. Mantenga `GET` libre de modificaciones intencionales del estado.
5. Utilice `GET` para recuperación convencional y consultas simples representables mediante Query Params.
6. Utilice `QUERY` para consultas safe e idempotentes que requieran un Request Body complejo cuando el stack completo lo soporte.
7. Utilice `POST /resource/search` únicamente como fallback cuando una consulta compleja requiera body y exista una limitación real para utilizar `QUERY`.
8. Mantenga Search Contracts y lógica de aplicación independientes de `GET`, `QUERY` o del fallback `POST`.
9. Utilice `POST` normalmente para creación o comandos con semántica POST.
10. Utilice `201 Created` para creación exitosa de recursos.
11. Incluya `Location` cuando un recurso creado tenga una URI pública identificable.
12. Utilice `PUT` para reemplazo completo e idempotente cuando la API necesite esa capacidad.
13. Utilice `PATCH` para modificaciones parciales.
14. Utilice normalmente `204 No Content` para eliminaciones exitosas sin Response Body.
15. No envíe Response Body con `204`.
16. Utilice Status Codes según la semántica pública definida.
17. No comunique errores mediante `200 OK`.
18. Prefiera el Response handling estándar de NestJS y evite `@Res()` para casos normales.
19. Valide Query Params y Request Bodies de `QUERY` mediante Request Schemas.
20. Exponga únicamente filtros y campos sortable definidos por el contrato público.
21. No permita que contratos HTTP expongan directamente estructuras Prisma.
22. Pagina colecciones potencialmente grandes mediante la convención global.
23. Utilice Idempotency Keys únicamente en operaciones donde los reintentos puedan producir efectos duplicados relevantes.
24. Mantenga Bulk Operations explícitas respecto a atomicidad, límites y partial failures.
25. Utilice acciones verbales en rutas sólo cuando la operación del dominio no pueda representarse razonablemente mediante recursos y métodos estándar.
26. Mantenga semántica consistente entre Features equivalentes.
27. Mantenga las rutas y contratos independientes de la estructura física de persistencia.
28. Verifique la compatibilidad completa de CORS, proxies, gateways, CDN/WAF, OpenAPI y tooling antes de adoptar `QUERY` en producción.
29. Documente métodos, paths, Status Codes, Requests y Responses mediante OpenAPI.
30. Verifique mediante E2E Tests la semántica HTTP pública.
