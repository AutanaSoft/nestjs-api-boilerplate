# Serialización

Este documento define las convenciones para convertir resultados internos de aplicación en Responses HTTP públicas.

Las reglas compartidas de ownership, Schema/Type y separación de contratos se definen en `http-contracts.md`.

## Límite de salida

Los valores retornados por Services no deben convertirse automáticamente en contratos públicos sólo porque sean serializables como JSON.

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

## StandardSchemaSerializerInterceptor

El proyecto utiliza `StandardSchemaSerializerInterceptor` como mecanismo predeterminado para Response serialization schema-first con Zod 4.

```typescript
@UseInterceptors(StandardSchemaSerializerInterceptor)
@SerializeOptions({ schema: userResponseSchema })
@Get(':id')
findOne(@Param('id') id: string) {
  return this.usersService.findById(id);
}
```

Cuando la estrategia sea global, el Interceptor puede registrarse en el bootstrap compartido y cada Endpoint debe declarar su Response Schema cuando corresponda.

`ClassSerializerInterceptor` y `class-transformer` no deben introducirse como una estrategia paralela por defecto.

## Response Schemas

Cada Response pública estructurada y estable debe declarar un Schema compatible con Standard Schema.

```typescript
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
```

El Response Schema define la forma pública final. Si el valor retornado no cumple el contrato, la serialización debe fallar en lugar de enviar una Response incompatible.

## Mappers

Utilice un Mapper únicamente cuando exista una transformación semántica real entre el resultado de aplicación y la Response pública.

Puede utilizarse para:

- seleccionar o renombrar campos;
- construir estructuras públicas;
- convertir fechas o tipos no JSON;
- adaptar relaciones;
- transformar valores de dominio.

```typescript
export const toUserResponse = (user: UserResult) => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});
```

Los Mappers deben permanecer puros y libres de I/O, reglas de negocio y decisiones de autorización.

## Persistencia y campos públicos

Los records de Prisma no deben devolverse directamente desde Controllers como contrato público por defecto.

El Response Contract debe seleccionar positivamente los campos públicos y no depender de la forma generada por persistencia.

No exponga accidentalmente:

- passwords o hashes;
- tokens o secrets internos;
- security metadata;
- claves internas de providers;
- relaciones o campos de persistencia no incluidos en el contrato.

Las relaciones cargadas por Prisma no forman parte automáticamente de la Response.

## Representaciones JSON

Las Responses deben utilizar representaciones JSON estables.

Fechas públicas deben representarse mediante strings en el formato definido por el contrato. Valores como `bigint`, `Decimal`, `Buffer` u otros tipos específicos del runtime u ORM deben convertirse antes de alcanzar la Response pública.

## Colecciones

Las Responses de colección deben definir explícitamente la forma de cada item y su metadata pública.

La estructura de pagination debe seguir `../api/pagination.md` y no redefinirse de forma diferente en cada Feature.

## Responses especiales

Archivos, streams u otros transports especiales pueden utilizar el mecanismo específico de NestJS correspondiente y no necesitan forzarse artificialmente a través de un Response Schema de objeto.

Las excepciones deben ser explícitas en el Endpoint.

## Errores de serialización

Un fallo del Response Schema representa un incumplimiento interno del contrato de salida y debe manejarse según `error-handling.md`.

No debe atribuirse al cliente ni exponerse como un error de Zod o del Interceptor.

## Reglas

1. Mantenga un límite explícito entre resultados internos y Responses públicas.
2. Utilice `StandardSchemaSerializerInterceptor` como mecanismo predeterminado de Response serialization.
3. Declare Response Schemas mediante Standard Schema en Endpoints estructurados.
4. Utilice Mappers sólo cuando exista una transformación semántica real.
5. No utilice `ClassSerializerInterceptor` o `class-transformer` como estrategia paralela por defecto.
6. No utilice records de Prisma como contratos públicos implícitos.
7. Construya Responses mediante selección positiva de campos públicos.
8. No exponga secrets, tokens, hashes, security metadata ni relaciones no declaradas.
9. Convierta fechas y tipos no JSON a representaciones públicas estables.
10. Mantenga los Mappers puros y libres de autorización o I/O.
11. Utilice la convención global de pagination para Responses paginadas.
12. Trate fallos del Response Schema como errores internos del contrato.
