# Manejo de errores

Este documento define las convenciones para representar, traducir, registrar y exponer errores en la aplicación.

El objetivo es mantener separados los errores internos de la aplicación de su representación HTTP pública, proporcionar respuestas consistentes a los clientes y conservar suficiente información diagnóstica sin exponer detalles sensibles.

## Límite de errores

Los errores pueden originarse en distintos niveles:

```text
HTTP Request
    ↓
Validation
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Infrastructure
```

Un error no debe atravesar automáticamente todos estos límites conservando la representación de la tecnología que lo originó.

Cada boundary debe traducir los errores que le pertenecen cuando esa traducción sea necesaria para preservar la semántica de la aplicación.

Por ejemplo:

```text
Prisma unique constraint error
        ↓
Repository / Persistence Boundary
        ↓
Application Conflict Error
        ↓
HTTP Error Boundary
        ↓
409 Conflict
```

El cliente HTTP no debe conocer códigos internos de Prisma, stack traces, estructuras de Zod ni detalles de providers externos.

## Categorías de errores

La aplicación debe distinguir al menos entre:

### Validation Errors

Representan input externo que no cumple un contrato HTTP.

Ejemplos:

- Request Body inválido;
- Query Params inválidos;
- Route Params inválidos;
- formato o tipo incorrecto;
- campos requeridos ausentes.

Estos errores se originan en el Validation Boundary y deben traducirse al contrato HTTP global de errores.

Los errores estructurales de Request utilizan `400 Bad Request` como convención global.

### Authentication Errors

Representan Requests que no contienen credentials válidas o aceptables.

Ejemplos:

- Access Token ausente;
- Access Token inválido;
- Access Token expirado;
- principal autenticado no válido.

Estos errores normalmente producen:

```text
401 Unauthorized
```

### Authorization Errors

Representan Requests autenticados cuyo principal no tiene permiso para ejecutar la operación solicitada.

Estos errores normalmente producen:

```text
403 Forbidden
```

La política concreta de autorización se define por separado en `authorization.md`.

### Not Found Errors

Representan recursos que no existen dentro del alcance de la operación solicitada.

Estos errores normalmente producen:

```text
404 Not Found
```

No toda ausencia de datos debe convertirse automáticamente en `404`.

La semántica depende del caso de uso. Por ejemplo, una búsqueda interna opcional puede representar ausencia mediante `null` o un resultado equivalente sin que exista un error HTTP.

### Conflict Errors

Representan una operación válida cuya ejecución entra en conflicto con el estado actual del sistema.

Ejemplos:

- email ya registrado;
- recurso duplicado;
- transición de estado incompatible;
- constraint de unicidad relevante para el caso de uso.

Estos errores normalmente producen:

```text
409 Conflict
```

Un constraint de base de datos no debe exponerse directamente como error Prisma. Debe traducirse a un error de aplicación cuando represente una condición significativa del caso de uso.

### Rate Limit Errors

Representan Requests rechazados por exceder los límites configurados.

Estos errores normalmente producen:

```text
429 Too Many Requests
```

### Internal Errors

Representan fallos inesperados o condiciones que la aplicación no puede manejar como parte normal del contrato público.

Ejemplos:

- errores inesperados de infraestructura;
- fallo de conexión no traducido;
- excepción de programación;
- fallo de un Response Schema;
- estado interno imposible;
- excepción desconocida.

Estos errores normalmente producen:

```text
500 Internal Server Error
```

Los detalles internos no deben exponerse al cliente.

## Application Errors

Los Services deben expresar condiciones esperadas del caso de uso mediante Application Errors con semántica explícita.

Por ejemplo:

```typescript
export class UserNotFoundError extends Error {}

export class EmailAlreadyExistsError extends Error {}
```

Estos errores representan comportamiento de aplicación, no códigos HTTP.

Un Service no debe necesitar conocer que:

```text
UserNotFoundError
```

se convertirá en:

```text
404 Not Found
```

La traducción HTTP pertenece al transport boundary.

```text
Service
   ↓
Application Error
   ↓
HTTP Error Boundary
   ↓
HTTP Status + Error Response
```

Esto permite que el mismo caso de uso pueda ejecutarse desde HTTP, un worker, CLI u otro application context sin depender de semántica HTTP.

## HTTP Error Boundary

La aplicación debe tener un mecanismo global responsable de convertir errores aceptados en Responses HTTP consistentes.

En NestJS, este boundary debe implementarse mediante un global `Exception Filter` o una composición equivalente centralizada.

El `Exception Filter` global es responsable de:

1. identificar el error recibido;
2. determinar si corresponde a un error conocido;
3. asignar el HTTP Status apropiado;
4. asignar un error code público estable;
5. construir el Error Response;
6. registrar el error con el nivel y contexto apropiados;
7. evitar la exposición de información interna.

Los Controllers no deben repetir manualmente esta traducción.

Evite:

```typescript
try {
  return await this.usersService.findById(id);
} catch (error) {
  throw new NotFoundException();
}
```

cuando la traducción pueda resolverse de forma consistente mediante el Error Boundary global.

Los Controllers pueden lanzar o propagar errores cuando sean responsables directos de una condición HTTP específica, pero no deben convertirse en el lugar general de traducción de errores de aplicación.

## Error Response

Todas las Responses de error JSON de la API deben usar una estructura consistente.

```json
{
  "statusCode": 404,
  "code": "USER_NOT_FOUND",
  "message": "User not found",
  "requestId": "01J..."
}
```

Los campos base son:

### `statusCode`

HTTP Status numérico de la Response.

Ejemplo:

```json
404
```

### `code`

Identificador público estable y machine-readable del tipo de error.

Ejemplos:

```text
USER_NOT_FOUND
EMAIL_ALREADY_EXISTS
VALIDATION_FAILED
UNAUTHORIZED
FORBIDDEN
INTERNAL_ERROR
```

Los clientes no deben necesitar interpretar `message` para identificar programáticamente el error.

Los códigos públicos deben permanecer estables mientras su semántica pública no cambie.

### `message`

Descripción pública legible por humanos.

El mensaje no debe contener:

- stack traces;
- SQL;
- paths internos;
- nombres de tablas;
- secrets;
- tokens;
- detalles de infraestructura;
- información sensible del usuario.

### `requestId`

Identificador de la Request cuando la aplicación disponga de Request correlation.

Permite relacionar una Response pública con sus logs internos sin exponer detalles diagnósticos.

La generación y propagación de `requestId` se definirá junto con las convenciones de observabilidad.

## Error Details

Algunos errores pueden requerir información pública adicional.

Por ejemplo, un Validation Error puede incluir detalles de campos:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "requestId": "01J...",
  "details": [
    {
      "path": ["email"],
      "code": "invalid_format",
      "message": "Invalid email address"
    }
  ]
}
```

`details` debe ser opcional y su forma debe estar definida por el tipo de error público correspondiente.

No debe utilizarse como contenedor arbitrario para objetos internos.

En particular, no debe incluir directamente:

- `ZodIssue[]`;
- Prisma errors;
- provider payloads;
- stack traces;
- objetos `Error`;
- Request Bodies completos.

## Validation Errors

`StandardSchemaValidationPipe` debe traducir los fallos del Request Schema hacia el Error Boundary de la aplicación.

Un `ZodError` no debe convertirse directamente en Response pública.

```text
Zod Validation Failure
        ↓
Validation Boundary
        ↓
Validation Error
        ↓
HTTP Error Boundary
        ↓
400 Bad Request
```

Los detalles públicos pueden conservar:

- path del campo;
- código público de validación;
- mensaje seguro.

Los detalles internos específicos de Zod deben permanecer fuera del contrato público cuando no sean necesarios.

Todos los Endpoints deben utilizar la misma semántica `400 Bad Request` para errores estructurales de Request.

## Persistence Errors

Los errores de Prisma pertenecen al Persistence Boundary.

Repositories o componentes específicos de persistencia deben traducir un error de Prisma cuando su significado sea relevante para la aplicación.

Por ejemplo:

```text
Prisma unique constraint
        ↓
EmailAlreadyExistsError
```

No todo error de Prisma debe convertirse en un Application Error específico.

Un error inesperado de conexión, query o infraestructura puede propagarse como error interno y ser tratado por el Error Boundary como fallo inesperado.

No exponga al cliente:

- códigos Prisma;
- nombres de constraints;
- nombres de tablas;
- queries;
- database URLs;
- detalles de conexión.

## External Service Errors

Los Adapters que consumen servicios externos deben traducir errores del provider cuando la aplicación necesite una semántica independiente del provider.

```text
Provider Error
    ↓
External Adapter
    ↓
Application / Infrastructure Error
```

La aplicación no debe depender de mensajes, status codes o payloads internos de un provider fuera del Adapter que posee esa integración.

Los payloads completos de errores externos no deben propagarse hacia Responses públicas ni almacenarse indiscriminadamente en logs.

## Response Serialization Errors

Un fallo del `StandardSchemaSerializerInterceptor` indica que la aplicación intentó producir una Response que no cumple su contrato de salida.

Este fallo representa un error interno de contrato.

```text
Application Result
      ↓
Response Schema
      ↓
Validation Failure
      ↓
500 Internal Server Error
```

No debe traducirse a `400` ni atribuirse al cliente.

El error debe registrarse con suficiente contexto para diagnosticar qué Endpoint y operación produjeron una Response inválida, sin registrar datos sensibles completos.

## Unknown Errors

Los valores capturados en bloques `catch` deben tratarse como `unknown`.

```typescript
try {
  await operation();
} catch (error: unknown) {
  // narrow before reading error properties
}
```

No asuma que todo valor capturado:

- es instancia de `Error`;
- posee `message`;
- posee `code`;
- tiene una estructura de una librería específica.

Debe realizarse narrowing antes de acceder a propiedades.

Los errores desconocidos que alcancen el Error Boundary deben tratarse como Internal Errors y producir una Response pública segura.

## Logging

Los errores internos deben registrarse mediante structured logging.

Prefiera:

```typescript
logger.error(
  {
    err: error,
    requestId,
    operation: 'create-user',
  },
  'Failed to create user',
);
```

en lugar de:

```typescript
console.error(`Failed to create user: ${error}`);
```

Los mensajes de log deben ser estables y el contexto variable debe almacenarse en campos estructurados.

Los logs no deben contener:

- passwords;
- Access Tokens;
- Refresh Tokens;
- secrets;
- Authorization headers completos;
- cookies sensibles;
- Request Bodies completos cuando contengan datos sensibles;
- datos de tarjetas u otros secrets;
- connection strings con credentials.

## Logging por categoría

No todos los errores deben registrarse con el mismo nivel.

Errores esperados del cliente, como Validation Errors o determinados `404`, no deben producir automáticamente logs de severidad `error`.

Una estrategia habitual puede ser:

```text
Expected client error        → no log / debug / info
Suspicious security event    → warn
Unexpected application error → error
Infrastructure failure       → error
```

La estrategia concreta puede ajustarse según observabilidad y operación, pero los errores esperados no deben generar ruido equivalente a fallos internos.

## Error Codes

Los códigos de error públicos deben:

- ser estables;
- ser machine-readable;
- representar semántica pública;
- evitar detalles tecnológicos;
- utilizar una convención consistente.

Ejemplos:

```text
VALIDATION_FAILED
USER_NOT_FOUND
EMAIL_ALREADY_EXISTS
UNAUTHORIZED
FORBIDDEN
RATE_LIMIT_EXCEEDED
INTERNAL_ERROR
```

Evite códigos como:

```text
PRISMA_P2002
ZOD_INVALID_TYPE
POSTGRES_23505
```

cuando formen parte del contrato público.

Los códigos tecnológicos pueden conservarse internamente para diagnóstico cuando sea seguro y útil.

## NestJS HttpException

Las `HttpException` de NestJS pueden utilizarse cuando una condición pertenece genuinamente al HTTP Boundary.

No deben convertirse en el mecanismo general para representar reglas de negocio dentro de Services.

Evite:

```typescript
@Injectable()
export class UsersService {
  async findById(id: string) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }
}
```

Prefiera un error independiente del transport:

```typescript
if (!user) {
  throw new UserNotFoundError(id);
}
```

y traduzca ese error en el HTTP Error Boundary.

## Información diagnóstica y Response pública

Debe mantenerse una separación estricta entre información pública y diagnóstica.

```text
Internal Error
    ├── Logs / Diagnostics
    │      ├── stack
    │      ├── operation
    │      ├── requestId
    │      └── safe technical context
    │
    └── Public Response
           ├── statusCode
           ├── code
           ├── message
           └── requestId
```

El cliente recibe únicamente la información necesaria para comprender y manejar el error público.

La información necesaria para investigar el fallo permanece en observabilidad.

## Testing

Los Application Errors deben probarse en el nivel práctico más pequeño.

Los Unit Tests deben verificar:

- qué Application Error produce un Service;
- traducciones específicas de errores de infraestructura cuando correspondan;
- mappings de errores conocidos.

Los E2E Tests deben verificar:

- HTTP Status;
- Error Response;
- error code;
- validation details cuando correspondan;
- `401` frente a `403`;
- ausencia de stack traces;
- ausencia de errores Prisma o Zod internos;
- ausencia de información sensible;
- comportamiento de errores inesperados cuando sea posible probarlo de forma controlada.

No pruebe detalles privados del `Exception Filter` desde E2E; pruebe el contrato HTTP observable.

## Reglas

1. Mantenga separados los errores internos y su representación HTTP pública.
2. Represente condiciones esperadas del caso de uso mediante Application Errors independientes del transport.
3. Centralice la traducción HTTP mediante un global Exception Filter o un Error Boundary equivalente.
4. Utilice un Error Response consistente para todas las Responses JSON de error.
5. Incluya un error `code` público estable y machine-readable.
6. No utilice `message` como identificador programático del error.
7. No exponga stack traces, errores Prisma, `ZodError`, SQL ni payloads internos de providers.
8. Traduzca Validation Errors antes de exponerlos al cliente y utilice `400 Bad Request` para errores estructurales de Request.
9. Traduzca errores de persistencia sólo cuando tengan una semántica relevante para la aplicación.
10. Mantenga errores y códigos específicos de providers dentro de sus Adapters o boundaries.
11. Trate los valores capturados en `catch` como `unknown` y realice narrowing antes de leer sus propiedades.
12. Trate los fallos de Response Schema como Internal Errors del servidor.
13. Utilice structured logging para errores y contexto diagnóstico.
14. No registre secrets, credentials, tokens ni payloads sensibles completos.
15. Diferencie entre errores esperados del cliente y fallos internos al elegir el nivel de logging.
16. Utilice `HttpException` para condiciones propias del HTTP Boundary, no como representación general de reglas de negocio en Services.
17. Mantenga estable la semántica de los códigos de error públicos.
18. Incluya `requestId` en el Error Response cuando exista Request correlation.
19. Verifique mediante E2E Tests el contrato público de errores y la ausencia de información interna.
20. Aplique `400 Bad Request` como convención global para errores estructurales de validación de Request.
