# Serialización

Este documento define las convenciones para convertir resultados internos de aplicación en Responses HTTP públicas.

Las reglas compartidas de ownership, Schema/Type, separación de contratos y Standard Schema se definen en
`http-contracts.md`.

## Límite de salida

Los valores retornados por Services no deben convertirse automáticamente en contratos públicos sólo porque sean
serializables como JSON.

La dirección esperada es:

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

El Controller debe exponer únicamente datos que formen parte del contrato público del Endpoint.

## StandardSchemaSerializerInterceptor

El proyecto utiliza `StandardSchemaSerializerInterceptor` como mecanismo predeterminado para Response serialization
schema-first con Zod 4.

El Interceptor valida y transforma el valor retornado por el handler utilizando el Response Schema definido mediante
`@SerializeOptions({ schema })`.

```typescript
@UseInterceptors(StandardSchemaSerializerInterceptor)
@SerializeOptions({ schema: userResponseSchema })
@Get(':id')
findOne(@Param('id') id: string) {
  return this.usersService.findById(id);
}
```

Cuando esta estrategia sea global para la aplicación, el Interceptor puede registrarse en el bootstrap compartido y cada
Endpoint debe declarar su Response Schema cuando corresponda.

La serialización schema-first es la estrategia predeterminada del proyecto. `ClassSerializerInterceptor` y
`class-transformer` no deben introducirse como una segunda estrategia paralela salvo que un requisito documentado lo
justifique.

## Response Schema

Cada Response pública estructurada y estable debe declarar un Schema compatible con Standard Schema.

```typescript
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
```

El Response Schema define la forma pública final. Si el valor retornado no cumple el contrato, la serialización debe
fallar en lugar de enviar una Response incompatible silenciosamente.

Las reglas generales de ownership y derivación del Type se encuentran en `http-contracts.md`.

## Mappers

`StandardSchemaSerializerInterceptor` no sustituye un Mapper cuando existe una transformación semántica entre el resultado
de aplicación y el contrato HTTP.

Utilice un Mapper cuando sea necesario:

- seleccionar campos públicos;
- renombrar propiedades;
- construir estructuras anidadas;
- convertir valores de dominio;
- preparar relaciones;
- convertir tipos que no tienen representación JSON pública adecuada.

```typescript
export const toUserResponse = (user: UserResult) => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});
```

El flujo sería:

```text
Service Result
    ↓
Response Mapper
    ↓
Controller
    ↓
StandardSchemaSerializerInterceptor
    ↓
Response Schema
```

No agregue Mappers cuando el resultado de aplicación ya representa correctamente el contrato público y no existe
transformación real que justificar.

## Persistencia

Los records de Prisma no deben devolverse directamente desde Controllers como contrato público por defecto.

Un Repository puede recuperar campos adicionales para resolver un caso de uso sin que esos campos formen parte de la
Response.

El Service debe exponer un resultado apropiado para la aplicación. El límite de transporte, mediante Mapper cuando sea
necesario y Response Schema siempre que corresponda, define la salida pública.

No dependa de la forma generada por Prisma como definición implícita de la API.

## Sensitive Fields

Los campos sensibles deben excluirse mediante construcción positiva del contrato público.

El Response Schema debe enumerar los campos permitidos. No dependa únicamente de eliminar campos sensibles después de
haber construido una representación completa.

Los campos que normalmente no deben aparecer en Responses públicas incluyen, según corresponda:

- passwords;
- password hashes;
- Refresh Token hashes o representaciones persistidas;
- secrets;
- tokens internos;
- security metadata;
- claves internas de proveedores externos;
- campos administrativos no incluidos en el contrato;
- detalles internos de persistencia.

`StandardSchemaSerializerInterceptor` proporciona una verificación adicional del contrato final, pero no sustituye una
selección clara de datos en la arquitectura interna.

## Relaciones

Las relaciones cargadas por Prisma no forman parte automáticamente del Response Contract.

Incluya únicamente las relaciones requeridas por el Endpoint.

Evite devolver grafos relacionales completos por conveniencia.

Cuando una relación pública requiera una forma distinta de su representación interna, utilice un Mapper antes del
Interceptor.

## Fechas y tipos no JSON

Las Responses deben definir representaciones JSON estables.

Las fechas públicas deben representarse mediante strings en un formato documentado y consistente, normalmente ISO 8601.

Valores como `bigint`, `Decimal`, `Buffer` u otros tipos específicos del runtime u ORM deben convertirse antes de alcanzar
la Response pública cuando formen parte del contrato.

El Mapper o un Transform puro del Response Schema puede realizar esa conversión cuando corresponda.

## Collections

Las Responses de colección deben definir explícitamente la forma de cada item y su metadata pública.

```typescript
export const userListResponseSchema = z.object({
  data: z.array(userResponseSchema),
});
```

La estructura de paginación debe seguir la convención global de paginación y no definirse de forma diferente en cada
Feature.

## Streams y Responses especiales

No todos los handlers HTTP deben pasar por serialización de objetos estándar.

Responses especiales como archivos o streams deben seguir el mecanismo apropiado de NestJS y no forzarse artificialmente
a través de un Response Schema de objeto cuando el transporte requiera otro comportamiento.

Estas excepciones deben ser explícitas en el Endpoint.

## Errores de serialización

Un fallo del Response Schema representa un incumplimiento interno del contrato, no un error causado por input del cliente.

No exponga el error de Zod, detalles del Interceptor ni stack traces directamente al cliente.

El fallo debe traducirse mediante la convención global de manejo de errores y registrarse con suficiente contexto para
diagnóstico.

## Testing

Los Mappers puros pueden probarse mediante Unit Tests.

Los E2E Tests deben verificar que:

- la Response cumple el Schema público;
- las transformaciones esperadas se aplican;
- los campos sensibles permanecen ausentes;
- las relaciones no autorizadas no se filtran;
- cambios internos de Prisma no amplían automáticamente la API pública.

## Reglas

1. Trate la serialización como un límite explícito entre resultados internos y Responses HTTP públicas.
2. Utilice `StandardSchemaSerializerInterceptor` como mecanismo predeterminado para Response serialization schema-first.
3. Declare el Response Schema mediante `@SerializeOptions({ schema })` en los Endpoints estructurados que corresponda.
4. Utilice Zod 4 Schemas compatibles con Standard Schema para definir Responses públicas.
5. Utilice Mappers sólo cuando exista una transformación real entre el resultado de aplicación y la Response pública.
6. No utilice `ClassSerializerInterceptor` o `class-transformer` como estrategia paralela por defecto.
7. No devuelva records de Prisma directamente como contrato público por defecto.
8. Construya Responses mediante selección positiva de campos públicos.
9. No exponga passwords, hashes, secrets, tokens internos ni security metadata fuera de contratos que explícitamente los requieran.
10. No exponga relaciones completas sólo porque hayan sido cargadas por persistencia.
11. Convierta fechas y tipos no JSON a representaciones públicas estables.
12. Mantenga los Mappers libres de I/O, reglas de negocio y decisiones de autorización.
13. Trate los fallos del Response Schema como incumplimientos internos del contrato y no como errores de Request.
14. Verifique mediante E2E Tests los Response Contracts y la ausencia de campos sensibles.
