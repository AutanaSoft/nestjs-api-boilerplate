# Observabilidad

Status: Target

Este documento define la estrategia transversal de observabilidad de la aplicación.

La observabilidad se basa en:

- Logs;
- Metrics;
- Traces.

## Logs

La aplicación debe utilizar structured logging.

Los mensajes deben ser estables y el contexto relevante debe representarse mediante campos estructurados.

No registre:

- secrets;
- tokens;
- passwords;
- payloads sensibles completos.

Los errores inesperados deben registrar contexto diagnóstico suficiente sin exponer información sensible. La
implementación base usa `ConsoleLogger` de NestJS detrás de `ApplicationLogger` y el token `APP_LOGGER`. La política se
deriva exclusivamente de `appConfig.nodeEnv`: en producción se habilitan `log`, `warn`, `error` y `fatal`, con
`json: true` y `colors: false`, para que cada registro sea JSON estricto directamente parseable; en cualquier otro
entorno se habilitan también `debug` y `verbose`, preservando `json: true` y `colors: true`.

NestJS decide qué registros emite antes de escribir en stdout o stderr. PM2 es responsable solo de capturar, persistir,
rotar y reenviar esos streams; su configuración no selecciona niveles ni transforma el formato de los eventos de la
aplicación.

Los eventos HTTP terminales usan el mensaje estable `http.request.completed`. Sus únicos campos variables permitidos son
`requestId`, `method`, `route`, `statusCode` y `durationMs`; no incluyen bodies, query strings, cookies ni headers. Las
rutas sin handler, incluido preflight CORS, usan la etiqueta estable `unmatched` en vez de una URL recibida. Existe un
único evento terminal por Request, incluso cuando el HTTP Error Boundary construye una respuesta de error.

Los fallos internos se registran mediante `logUnexpectedHttpError()` con el evento estable `http.request.failed`. Su
metadata es cerrada: `requestId`, `requestIdFallback`, `method`, `route` y `errorType`. `method` y `route` se normalizan
con la misma política del evento terminal, y `errorType` es una clasificación interna segura; no se registra el mensaje
variable del error. El evento se emite solo para fallos internos, incluidos errores desconocidos y
`ResponseContractViolation`; los errores esperados de aplicación no generan este diagnóstico.

La metadata de `http.request.failed` no puede incluir stack, `cause`, body, query string, cookies, headers,
credenciales, tokens, secretos, payloads de providers ni valores inválidos de contratos de salida.

## Lifecycle de proceso

Al completar el startup, la aplicación emite `lifecycle.startup.completed` mediante el logger estructurado. Sus únicos
campos son `serverUrl`, `apiBasePath` y, cuando OpenAPI está habilitado, `openapiUrl`; no se incluyen otros valores de
configuración ni rutas del documento JSON.

El apagado emite `lifecycle.shutdown.started` y `lifecycle.shutdown.completed` mediante el logger estructurado. Sus
campos cerrados son, respectivamente, `signal` y `timeoutMs`, y `signal` y `durationMs`. Los resultados terminales
`lifecycle.shutdown.timed_out` y `shutdown.failed` se escriben una vez mediante un sink síncrono mínimo, con solo
`signal` y `timeoutMs`, antes de la salida forzada.

La configuración y el comportamiento operativo pertenecen a [process lifecycle](../configuration/process-lifecycle.md);
este documento es owner únicamente del contrato de eventos y sus límites de datos.

## Request Correlation

Cada Request debe disponer de un identificador de correlación:

```text
requestId
```

El mismo `requestId` debe propagarse durante el lifecycle de la Request y utilizarse en los eventos relacionados. Se
recibe y devuelve como `X-Request-Id`: solo se adopta un UUIDv4 canónico en minúsculas de 36 caracteres; cualquier otro
valor se reemplaza mediante `crypto.randomUUID()`. `RequestContextService` encapsula `AsyncLocalStorage`, incluido el
enlace de callbacks de finalización, para no exponer objetos Express a consumidores.

Si el HTTP Error Boundary no encuentra un contexto de Request, genera localmente un UUIDv4 mediante
`node:crypto.randomUUID()`. El mismo valor se usa en el header, el body de error y el log relacionado. En ese caso, solo
la metadata interna puede incluir `requestIdFallback: true`; el header y el body nunca exponen que se utilizó el
fallback ni confían en un valor entrante sin validar.

Cuando `requestId` forme parte de una Response pública, su contrato se define en `../api/http-contracts.md`.

## Metrics

La aplicación debe exponer Metrics suficientes para observar, cuando corresponda:

- volumen de Requests;
- latencia;
- Status Codes;
- errores;
- dependencias externas;
- operaciones relevantes de infraestructura.

Los nombres y labels deben ser estables.

No utilice labels de alta cardinalidad derivados de valores como:

- user IDs;
- request IDs;
- tokens;
- valores arbitrarios enviados por clientes.

## Tracing

La aplicación debe propagar tracing context cuando participe en operaciones distribuidas.

Los spans deben representar operaciones relevantes, como:

- HTTP Requests;
- database operations;
- external service calls.

No incluya información sensible en span attributes.

## OpenTelemetry

OpenTelemetry es la estrategia aprobada para instrumentación de Metrics y Traces.

La instrumentación debe permanecer independiente del backend utilizado para almacenar, consultar o visualizar telemetry.

## Reglas

1. Utilice structured logging.
2. Utilice mensajes estables y contexto estructurado.
3. No registre secrets ni información sensible.
4. Propague el mismo `requestId` durante el lifecycle de cada Request.
5. Registre fallos internos con `http.request.failed` y metadata cerrada, sin datos sensibles.
6. Mantenga un único evento terminal `http.request.completed` por Request.
7. Use el fallback UUIDv4 solo cuando no exista contexto y marque `requestIdFallback` únicamente en metadata interna.
8. Exponga Metrics suficientes para observar tráfico, latencia y errores.
9. Evite labels de alta cardinalidad.
10. Propague tracing context cuando exista interacción distribuida.
11. Utilice OpenTelemetry para Metrics y Traces.
12. Mantenga la instrumentación independiente del proveedor de observabilidad.
13. Mantenga los eventos de lifecycle con nombres estables y metadata cerrada.
