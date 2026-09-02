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

Los errores inesperados deben registrar contexto diagnóstico suficiente sin exponer información sensible.

## Request Correlation

Cada Request debe disponer de un identificador de correlación:

```text
requestId
```

El mismo `requestId` debe propagarse durante el lifecycle de la Request y utilizarse en los eventos relacionados.

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
4. Propague `requestId` durante el lifecycle de cada Request.
5. Exponga Metrics suficientes para observar tráfico, latencia y errores.
6. Evite labels de alta cardinalidad.
7. Propague tracing context cuando exista interacción distribuida.
8. Utilice OpenTelemetry para Metrics y Traces.
9. Mantenga la instrumentación independiente del proveedor de observabilidad.
