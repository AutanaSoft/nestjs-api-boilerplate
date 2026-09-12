# Observabilidad

Status: Target

Este documento define la estrategia transversal de observabilidad de la aplicación.

La observabilidad se basa en:

- Logs;
- Metrics;
- Traces.

## Logs

La aplicación debe utilizar structured logging.

Los mensajes deben ser estables y el contexto relevante debe representarse mediante campos
estructurados.

No registre:

- secrets;
- tokens;
- passwords;
- payloads sensibles completos.

Los errores inesperados deben registrar contexto diagnóstico suficiente sin exponer información
sensible. La implementación base usa `ConsoleLogger` de NestJS con `json: true` y `colors: true`
detrás de `ApplicationLogger` y el token `APP_LOGGER`. Los colores ANSI hacen que la representación
obtenida mediante `inspect()` no sea JSON estricto directamente parseable.

Los eventos HTTP terminales usan el mensaje estable `http.request.completed`. Sus únicos campos
variables permitidos son `requestId`, `method`, `route`, `statusCode` y `durationMs`; no incluyen
bodies, query strings, cookies ni headers. Las rutas sin handler, incluido preflight CORS, usan la
etiqueta estable `unmatched` en vez de una URL recibida.

## Request Correlation

Cada Request debe disponer de un identificador de correlación:

```text
requestId
```

El mismo `requestId` debe propagarse durante el lifecycle de la Request y utilizarse en los eventos
relacionados. Se recibe y devuelve como `X-Request-Id`: solo se adopta un UUIDv4 canónico en
minúsculas de 36 caracteres; cualquier otro valor se reemplaza mediante `crypto.randomUUID()`.
`RequestContextService` encapsula `AsyncLocalStorage`, incluido el enlace de callbacks de
finalización, para no exponer objetos Express a consumidores.

Cuando `requestId` forme parte de una Response pública, su contrato se define en
`../api/http-contracts.md`.

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

La instrumentación debe permanecer independiente del backend utilizado para almacenar, consultar o
visualizar telemetry.

## Reglas

1. Utilice structured logging.
2. Utilice mensajes estables y contexto estructurado.
3. No registre secrets ni información sensible.
4. Propague `requestId` durante el lifecycle de cada Request.
5. Exponga Metrics suficientes para observar tráfico, latencia y errores.
6. Evite labels de alta cardinalidad.
7. Propague tracing context cuando exista interacción distribuida.
8. Utilice OpenTelemetry para Metrics y Traces.
9. Mantenga la instrumentación independiente del proveedor de observabilidad.
