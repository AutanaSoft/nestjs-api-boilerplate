# Observabilidad

Este documento define las convenciones de observabilidad de la aplicación.

La observabilidad se basa en tres señales principales:

- Logs;
- Metrics;
- Traces.

## Logs

La aplicación debe utilizar structured logging.

Cada log debe utilizar un mensaje estable y campos estructurados para el contexto relevante.

Ejemplo conceptual:

```typescript
logger.info('request completed', {
  requestId,
  method,
  path,
  statusCode,
  durationMs,
});
```

No incluya secretos, tokens, passwords ni payloads sensibles completos.

Los errores inesperados deben registrar suficiente contexto diagnóstico sin exponer información sensible.

## Request Correlation

Cada Request debe tener un identificador de correlación:

```text
requestId
```

El mismo `requestId` debe propagarse durante el ciclo de vida de la Request y utilizarse en logs relacionados.

Cuando corresponda, también debe incluirse en el Error Response público.

## Metrics

La aplicación debe exponer Metrics suficientes para observar:

- volumen de Requests;
- latencia;
- Status Codes;
- errores;
- dependencia de servicios externos;
- operaciones relevantes de infraestructura.

Las Metrics deben utilizar nombres y labels estables.

Evite labels con alta cardinalidad, como:

- user IDs;
- request IDs;
- tokens;
- valores arbitrarios provenientes del cliente.

## Tracing

La aplicación debe propagar tracing context cuando participe en una arquitectura distribuida.

Los spans deben representar operaciones relevantes, como:

- HTTP Requests;
- database operations;
- external service calls.

No incluya información sensible en span attributes.

## OpenTelemetry

OpenTelemetry es la convención preferida para instrumentación de Metrics y Traces.

La instrumentación de la aplicación debe permanecer independiente del backend concreto utilizado para almacenar o visualizar telemetry.

## Reglas

1. Utilice structured logging.
2. Utilice mensajes de log estables y contexto estructurado.
3. No registre secretos ni información sensible.
4. Propague un `requestId` durante toda la Request.
5. Exponga Metrics de tráfico, latencia y errores.
6. Evite labels de alta cardinalidad.
7. Propague tracing context en operaciones distribuidas.
8. Utilice OpenTelemetry como estándar de instrumentación para Metrics y Traces.
9. Mantenga la instrumentación independiente del proveedor de observabilidad.
