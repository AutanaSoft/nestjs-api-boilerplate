# Serialización

Status: Target

Este documento define la estrategia técnica para convertir resultados internos de aplicación en Responses HTTP públicas.

Las convenciones de los contratos HTTP públicos se definen en `../api/http-contracts.md`.

## Límite de salida

Los resultados internos no deben convertirse automáticamente en contratos públicos sólo porque puedan serializarse como
JSON.

```text
Service Result
    ↓
Mapper (cuando sea necesario)
    ↓
Controller
    ↓
StandardSchemaSerializerInterceptor
    ↓
Response Schema
    ↓
HTTP Response
```

El Response Schema declarado para la operación define la representación que el mecanismo de serialización debe producir.

## Standard Schema

El proyecto utiliza `StandardSchemaSerializerInterceptor` como estrategia predeterminada de Response serialization.

`SerializationModule` registra un único interceptor global mediante `APP_INTERCEPTOR`. `AppModule` importa ese módulo
una sola vez; no se registran interceptores equivalentes en `main.ts`, `setupApplication()` ni en el bootstrap E2E.

Cada handler o controller que publique una Response JSON estructurada declara explícitamente su schema con
`@SerializeOptions({ schema })`. No existe un schema global permisivo: sin schema, el interceptor conserva el
passthrough nativo. Los archivos, streams y otras Responses especiales siguen esa excepción explícita.

El wrapper del proyecto delega en `StandardSchemaSerializerInterceptor` la resolución de metadata, el passthrough y la
validación o transformación Standard Schema. Solo traduce el fallo de salida que emerge de ese mecanismo a
`ResponseContractViolation`; no reimplementa el algoritmo de NestJS ni decide semántica HTTP.

El schema proyecta en el nivel superior únicamente las propiedades públicas declaradas. Una propiedad interna adicional
no alcanza la Response HTTP; los campos y su semántica pertenecen al contrato público.

`ClassSerializerInterceptor` y `class-transformer` no deben introducirse como estrategia paralela por defecto.

El ownership y la semántica del contrato público pertenecen a `../api/http-contracts.md`.

## Mappers

Utilice un Mapper cuando exista una transformación semántica entre el resultado interno y la representación pública.

Los Mappers pueden:

- seleccionar o renombrar campos;
- construir estructuras públicas;
- convertir tipos internos;
- adaptar relaciones.

Deben permanecer puros y libres de:

- I/O;
- reglas de negocio;
- decisiones de autorización.

## Persistencia

Los modelos de persistencia no deben convertirse implícitamente en Responses públicas.

La separación entre persistencia y contratos externos se define en `data-access.md`.

La serialización debe construir deliberadamente la representación pública correspondiente.

## Representaciones externas

Los valores específicos del runtime o infraestructura que no tengan una representación JSON directa deben convertirse
antes de alcanzar la Response pública.

La representación concreta pertenece al contrato público correspondiente.

## Colecciones

Las Responses paginadas deben seguir la convención definida en `../api/pagination.md`.

## Responses especiales

Archivos, streams u otros tipos de Response que requieran mecanismos específicos no necesitan forzarse mediante un
Response Schema de objeto.

La excepción debe ser explícita en el boundary correspondiente.

## Errores

Un fallo del Response Schema representa un incumplimiento interno del contrato de salida.

Su tratamiento pertenece a `error-handling.md`.

## Reglas

1. Mantenga un límite explícito entre resultados internos y Responses públicas.
2. Utilice `StandardSchemaSerializerInterceptor` como estrategia predeterminada.
3. Utilice Mappers sólo cuando exista una transformación semántica real.
4. Mantenga los Mappers puros y libres de autorización e I/O.
5. No convierta modelos de persistencia implícitamente en contratos públicos.
6. Convierta tipos internos a representaciones externas antes de la Response.
7. Mantenga explícitas las excepciones que no utilicen Response Schemas estructurados.
8. Trate fallos del Response Schema como errores internos.
9. Delegue contratos públicos, pagination y error translation a sus documentos owners.
