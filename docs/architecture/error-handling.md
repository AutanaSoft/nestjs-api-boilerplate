# Manejo de errores

Este documento define las convenciones para representar y traducir errores hacia Responses HTTP públicas.

Los errores internos de aplicación, persistencia e infraestructura no deben exponerse directamente al cliente.

## Error Boundary

La aplicación debe centralizar la traducción de errores mediante un global Exception Filter o un Error Boundary equivalente.

```text
Application / Infrastructure Error
            ↓
      HTTP Error Boundary
            ↓
HTTP Status + Error Response
```

Los Controllers no deben repetir manualmente mappings de errores de aplicación cuando puedan resolverse globalmente.

## Application Errors

Las condiciones esperadas del caso de uso deben representarse mediante Application Errors independientes del transport.

```typescript
export class UserNotFoundError extends Error {}
export class EmailAlreadyExistsError extends Error {}
```

Un Service no debe necesitar conocer qué HTTP Status corresponderá posteriormente a esos errores.

No utilice `HttpException` de NestJS como mecanismo general para representar reglas de negocio dentro de Services.

## Categorías HTTP

Convención base:

| Categoría | Status |
| --- | --- |
| Validation | `400 Bad Request` |
| Authentication | `401 Unauthorized` |
| Authorization | `403 Forbidden` |
| Not Found | `404 Not Found` |
| Conflict | `409 Conflict` |
| Rate Limit | `429 Too Many Requests` |
| Internal | `500 Internal Server Error` |

La política concreta de autorización se define en `authorization.md`.

## Error Response

Todas las Responses JSON de error deben utilizar una estructura consistente.

```typescript
export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.unknown().optional(),
});
```

Conceptualmente:

```json
{
  "statusCode": 404,
  "code": "USER_NOT_FOUND",
  "message": "User not found",
  "requestId": "01J..."
}
```

`code` debe ser estable y machine-readable. Los clientes no deben depender de `message` para identificar programáticamente el error.

`details` es opcional y debe contener únicamente información pública definida por el error correspondiente.

No exponga mediante el Error Response:

- stack traces;
- `ZodError` o `ZodIssue[]` sin transformar;
- errores o códigos internos de Prisma;
- SQL o nombres de constraints;
- payloads internos de providers;
- secrets, tokens o información sensible.

## Traducción entre boundaries

Cada boundary debe traducir errores tecnológicos cuando su significado tenga semántica para la aplicación.

```text
Prisma unique constraint
        ↓
Persistence Boundary
        ↓
EmailAlreadyExistsError
        ↓
HTTP Error Boundary
        ↓
409 Conflict
```

No todo error de infraestructura necesita un Application Error específico. Los fallos inesperados pueden propagarse hasta el Error Boundary y producir `500 Internal Server Error`.

Los Adapters externos deben aplicar el mismo principio y evitar que contratos de providers se propaguen hacia la aplicación pública.

## Validation Errors

Los fallos estructurales de Request utilizan:

```text
400 Bad Request
```

Los errores de Zod o Standard Schema deben traducirse a un error público estable antes de formar la Response.

La forma y ejecución de Request validation se define en `validation.md`.

## Response Contract Errors

Un fallo del Response Schema representa un incumplimiento interno del contrato de salida y debe producir:

```text
500 Internal Server Error
```

No debe atribuirse al cliente ni traducirse a `400 Bad Request`.

La serialización se define en `serialization.md`.

## Unknown Errors

Los valores capturados en `catch` deben tratarse como `unknown` y realizar narrowing antes de acceder a propiedades.

```typescript
try {
  await operation();
} catch (error: unknown) {
  // narrow before reading error properties
}
```

Un error desconocido que alcance el HTTP Error Boundary debe tratarse como Internal Error y producir una Response pública segura.

## Request Correlation

El Error Response incluye `requestId` para correlacionar la Response pública con telemetry interna.

La generación, propagación y logging de `requestId` pertenecen a `../operations/observability.md`.

## Reglas

1. Mantenga separados los errores internos y su representación HTTP pública.
2. Utilice Application Errors independientes del transport para condiciones esperadas del caso de uso.
3. Centralice la traducción HTTP mediante un Error Boundary global.
4. Utilice `{ statusCode, code, message, requestId, details? }` como Error Response estándar.
5. Mantenga `code` estable y machine-readable.
6. Utilice `400`, `401`, `403`, `404`, `409`, `429` y `500` según la categoría definida.
7. No exponga errores tecnológicos, stack traces ni información sensible en Responses públicas.
8. Traduzca errores de persistencia o providers cuando tengan semántica de aplicación.
9. Trate fallos del Response Schema como `500 Internal Server Error`.
10. Trate valores capturados en `catch` como `unknown`.
11. Mantenga logging y telemetry bajo las convenciones de observabilidad.
