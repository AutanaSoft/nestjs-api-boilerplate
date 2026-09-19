# Contratos HTTP

Status: Target

Este documento define las convenciones compartidas de los contratos HTTP públicos de la API.

Los contratos concretos de un Feature pertenecen a su PRD o especificación funcional cuando exista una responsabilidad
que justifique mantenerlos allí.

## Alcance

Los contratos HTTP pueden incluir:

- Request Body;
- Query Params;
- Route Params;
- Headers con semántica pública;
- Responses;
- estructuras públicas de colección y metadata;
- Error Responses.

Las convenciones REST generales se definen en `conventions.md`.

La implementación técnica de Request validation y Response serialization se define en `../architecture/validation.md` y
`../architecture/serialization.md`.

## Ownership

Cada contrato debe tener un único owner canónico.

Los contratos específicos de un Feature pertenecen al Feature que posee el Endpoint.

Los contratos compartidos deben tener un owner explícito y reutilizarse desde allí.

No mantenga definiciones públicas equivalentes bajo múltiples owners.

## Separación de contratos

Los contratos HTTP son independientes de los modelos internos de aplicación, persistencia e infraestructura.

Compartir campos no convierte esas representaciones en el mismo contrato.

Un cambio interno no debe modificar accidentalmente el contrato público.

## Request y Response

Request y Response son contratos diferentes aunque compartan información.

Cada uno debe modelar únicamente los campos y la semántica que corresponden a su boundary.

Los campos internos no forman parte de una Response pública únicamente porque estén disponibles en el modelo de
aplicación o persistencia. El schema canónico de una Response JSON estructurada declara sus propiedades públicas de
nivel superior; la Response no incluye propiedades adicionales no declaradas.

## Contrato inicial de health

`GET /api/v1/health/live` y `GET /api/v1/health/ready` son las primeras Responses JSON estructuradas que deben declarar
un contrato canónico explícito. Su forma de éxito contiene `status`, `info`, `error` y `details`.

El contrato canónico debe preservar esa semántica pública y no convertir la representación interna de Terminus en un
contrato implícito. Propiedades adicionales del resultado interno no se publican.

## Nullability y ausencia

La semántica pública debe distinguir explícitamente entre:

- una propiedad omitida;
- una propiedad presente con valor `null`.

La elección debe responder al significado real del contrato y mantenerse consistente entre documentación e
implementación.

## Composición

Los contratos compartidos pueden componerse cuando:

- exista un owner reutilizable;
- la composición preserve la semántica pública;
- no introduzca dependencias hacia modelos internos.

No reutilice automáticamente estructuras internas únicamente para reducir duplicación.

## Request correlation header

Every response includes `X-Request-Id`. Clients may send that header to correlate a request; the server adopts only a
canonical lowercase UUIDv4 textual value (36 characters) and replaces absent or invalid values with a newly generated
UUIDv4. Browser clients may send and read this header because the CORS policy allows and exposes it. This header is
independent of the future JSON error body defined below.

## Error Response

Las Responses JSON de error compartidas utilizan:

```typescript
type ErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};
```

`code` debe ser estable y machine-readable.

Los clientes no deben depender de `message` para identificar programáticamente un error.

`details` se omite por defecto. Solo puede incluirse cuando un proyector explícito asociado al código produce una
estructura definida por un contrato público tipado. No serialice el error original ni valores `unknown`; si el proyector
falla, omita `details` sin alterar el resto de la respuesta.

## Catálogo de Error Responses

Los códigos son `UPPER_SNAKE_CASE`, estables y tienen un único significado. Este es el catálogo completo para los status
compartidos:

<!-- markdownlint-disable MD013 -->

| Status | Código                  | Mensaje exacto                                           | Significado público                                               |
| ------ | ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`           | `The request is invalid.`                                | El Request no cumple el contrato público.                         |
| `401`  | `UNAUTHORIZED`          | `Authentication is required.`                            | No se proporcionó una autenticación aceptable.                    |
| `403`  | `FORBIDDEN`             | `You are not allowed to perform this action.`            | El principal autenticado no puede realizar la acción.             |
| `404`  | `ROUTE_NOT_FOUND`       | `The requested route was not found.`                     | No existe un handler para la ruta solicitada.                     |
| `404`  | `RESOURCE_NOT_FOUND`    | `The requested resource was not found.`                  | El recurso solicitado no está disponible.                         |
| `409`  | `CONFLICT`              | `The request conflicts with the current resource state.` | La operación entra en conflicto con el estado actual del recurso. |
| `429`  | `RATE_LIMIT_EXCEEDED`   | `Too many requests.`                                     | Se excedió el límite de solicitudes aplicable.                    |
| `500`  | `INTERNAL_SERVER_ERROR` | `An unexpected error occurred.`                          | Ocurrió un fallo interno o no confiable.                          |

<!-- markdownlint-enable MD013 -->

`ROUTE_NOT_FOUND` y `RESOURCE_NOT_FOUND` no son intercambiables. Los errores esperados específicos de aplicación deben
usar su código del catálogo; los fallbacks genéricos no los sustituyen. `UNAUTHORIZED` y `FORBIDDEN` son únicamente
fallbacks públicos definidos por la semántica HTTP: este catálogo no define mecanismos ni reglas de autenticación o
autorización de negocio.

Los fallos de contrato de salida siempre usan `500`, `INTERNAL_SERVER_ERROR` y el mensaje exacto del catálogo, sin
`details`.

El Error Response no debe exponer:

- stack traces;
- errores tecnológicos sin transformar;
- detalles internos de persistencia;
- payloads internos de Providers;
- secrets, tokens o información sensible.

La selección de HTTP Status Codes se define en `conventions.md`.

La traducción entre errores internos y el contrato HTTP se define en `../architecture/error-handling.md`.

## Enforcement y documentación

La estrategia técnica para validar Requests se define en `../architecture/validation.md`.

La estrategia técnica para serializar Responses se define en `../architecture/serialization.md`.

La representación de estos contratos en OpenAPI se define en `openapi.md`.

## Reglas

1. Mantenga un único owner por contrato público.
2. Mantenga separados los contratos HTTP y los modelos internos.
3. Mantenga Request y Response como responsabilidades distintas.
4. Modele explícitamente ausencia y `null`.
5. Componga contratos únicamente cuando se preserve ownership y semántica.
6. No exponga detalles internos únicamente porque formen parte de una representación interna.
7. Utilice `{ statusCode, code, message, requestId, details? }` como Error Response JSON compartido.
8. Utilice únicamente los códigos y mensajes exactos del catálogo compartido.
9. Omita `details` salvo proyección explícita desde un contrato público tipado.
10. Responda fallos de salida con `INTERNAL_SERVER_ERROR` y sin `details`.
11. No exponga información tecnológica o sensible mediante Error Responses.
12. Delegue validation, serialization y error translation a sus documentos arquitectónicos owners.
