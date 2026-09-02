# Serialización

Este documento define las convenciones de serialización para las respuestas HTTP públicas de la aplicación.

La serialización es el límite que transforma resultados internos de aplicación en contratos HTTP explícitos antes de que
sean enviados al cliente.

## Límite de serialización

Los valores retornados por Services o Repositories no deben convertirse automáticamente en contratos públicos sólo porque
sean serializables como JSON.

La dirección esperada es:

```text
Repository Record
      ↓
Application Result
      ↓
Response Mapping
      ↓
Response Schema
      ↓
HTTP Response
```

El Controller debe exponer únicamente datos que formen parte del contrato HTTP del Endpoint.

Los detalles de Prisma, relaciones cargadas, campos internos y metadata de persistencia no deben filtrarse accidentalmente
a la respuesta pública.

## Response Contracts

Cada respuesta pública estructurada debe tener un contrato explícito cuando su forma represente parte estable de la API.

Los Response Schemas pertenecen al Feature que posee el Endpoint correspondiente.

Una estructura habitual puede ser:

```text
src/modules/users/
├── dto/
│   ├── user-response.schema.ts
│   ├── user-list-response.schema.ts
│   └── create-user.schema.ts
└── users.controller.ts
```

El owner del Response Schema también debe derivar y exportar su Type cuando otros componentes necesiten referenciarlo.

```typescript
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
```

No mantenga un Type manual separado que pueda divergir del Schema que define el contrato público.

## Separación entre aplicación y transporte

Un resultado de aplicación y un Response DTO pueden compartir campos sin ser el mismo contrato.

Por ejemplo:

```text
UsersService Result
      ↓
User Response Mapper
      ↓
UserResponse
```

El Service no debe depender de detalles HTTP sólo para producir exactamente la forma de una Response.

La capa de aplicación puede retornar una representación apropiada para el caso de uso, mientras el límite de transporte
selecciona y serializa los campos públicos.

## Separación de persistencia

Los records de Prisma no deben devolverse directamente desde Controllers como contrato público por defecto.

Evite patrones equivalentes a:

```typescript
@Get(':id')
async findById(@Param('id') id: string) {
  return this.usersRepository.findById(id);
}
```

cuando el valor retornado sea un record de persistencia cuya forma esté determinada por Prisma.

Prefiera un límite explícito:

```typescript
const user = await this.usersService.findById(id);
return toUserResponse(user);
```

El modelo de persistencia puede cambiar por razones internas sin que esos cambios deban modificar automáticamente la API
pública.

## Mappers

Utilice un Mapper explícito cuando la forma interna y el contrato HTTP no sean idénticos o cuando exista riesgo de exponer
campos no públicos.

```typescript
export const toUserResponse = (user: UserResult): UserResponse => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});
```

Los Mappers deben ser funciones deterministas siempre que sea práctico.

Un Mapper de Response no debe:

- consultar la base de datos;
- realizar llamadas de red;
- ejecutar reglas de negocio;
- depender de estado mutable global;
- decidir permisos o autorización.

La lógica necesaria para determinar qué datos puede ver un caller debe resolverse antes de la serialización mediante la
capa de autorización o aplicación correspondiente.

## Sensitive Fields

Los campos sensibles deben excluirse mediante construcción positiva del contrato público.

No dependa únicamente de eliminar campos después de haber construido una representación completa.

Prefiera:

```typescript
return {
  id: user.id,
  email: user.email,
};
```

en lugar de:

```typescript
const response = { ...user };
delete response.passwordHash;
return response;
```

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

La ausencia de estos campos debe ser verificable mediante tests.

## Relaciones

Las relaciones persistidas no forman parte automáticamente del contrato público.

Un Repository puede cargar relaciones para resolver un caso de uso sin que esas relaciones deban aparecer completas en la
Response.

```text
Prisma Record + Relations
          ↓
Application Result
          ↓
Response Mapper
          ↓
Public Projection
```

Incluya únicamente las relaciones requeridas por el contrato del Endpoint.

Evite exponer grafos relacionales completos por conveniencia.

## Fechas y valores no JSON

Los contratos HTTP deben definir representaciones serializables y estables para valores que no poseen una representación
JSON directa adecuada.

Las fechas públicas deben representarse mediante strings en un formato documentado y consistente, normalmente ISO 8601.

Valores como `bigint`, `Decimal`, `Buffer` u otros tipos específicos de runtime u ORM no deben filtrarse directamente a la
Response sin una representación pública definida.

El Mapper o la capa de serialización debe convertirlos explícitamente cuando formen parte del contrato.

## Null, Undefined y campos omitidos

La serialización debe respetar la semántica definida por el Response Schema.

`null`, ausencia de una propiedad y un valor vacío pueden representar estados distintos.

No convierta automáticamente valores `undefined` a `null` ni viceversa sin que el contrato lo defina.

Los campos opcionales deben omitirse o incluirse según la semántica pública del Endpoint, no según detalles accidentales
de la representación interna.

## Collections

Las Responses que contienen colecciones deben definir explícitamente la forma de cada item y cualquier metadata pública
asociada.

Por ejemplo:

```typescript
export const userListResponseSchema = z.object({
  data: z.array(userResponseSchema),
});
```

La estructura de paginación, cuando corresponda, debe seguir la convención global de paginación y no inventarse de forma
diferente en cada Feature.

## Validación de salida

Los Response Schemas pueden utilizarse para verificar que la representación pública cumple el contrato esperado.

La validación de salida es especialmente útil en límites críticos, durante desarrollo, tests o donde un contrato incorrecto
pueda exponer datos sensibles.

No utilice la validación de salida como sustituto de un Mapper claro ni como mecanismo para ocultar una arquitectura que
devuelve estructuras arbitrarias desde capas internas.

La estrategia concreta de validación runtime de todas las Responses puede ajustarse según requisitos de performance, pero
el contrato público debe continuar siendo explícito y verificable.

## Errores

Las Responses de error no deben construirse mediante los Response Schemas de recursos normales.

Los errores siguen un contrato global independiente definido por la convención de manejo de errores.

Una excepción interna, un `ZodError`, un error de Prisma o un stack trace no deben serializarse directamente hacia el
cliente.

## Testing

Los tests deben verificar el comportamiento de serialización en el nivel práctico más pequeño.

Los Mappers puros pueden probarse mediante Unit Tests.

Los E2E Tests deben verificar contratos HTTP públicos y, en particular, la ausencia de campos sensibles en Responses donde
no correspondan.

Cuando una modificación de persistencia agregue un nuevo campo interno, los tests públicos deben ayudar a garantizar que
ese campo no aparezca automáticamente en la API.

## Reglas

1. Trate la serialización como un límite explícito entre resultados internos y Responses HTTP públicas.
2. Defina Response Schemas para contratos públicos estructurados y estables.
3. Mantenga los Response Contracts bajo el ownership del Feature que posee el Endpoint.
4. Derive y exporte el Type junto al Response Schema que lo define.
5. Mantenga separados los contratos de transporte, aplicación y persistencia.
6. No devuelva records de Prisma directamente desde Controllers como contrato público por defecto.
7. Utilice Mappers explícitos cuando la representación interna y la Response pública difieran o exista riesgo de exposición.
8. Construya Responses mediante selección positiva de campos públicos en lugar de eliminar campos sensibles posteriormente.
9. No exponga passwords, hashes, secrets, tokens internos ni security metadata fuera de contratos que explícitamente los requieran.
10. No exponga relaciones completas sólo porque hayan sido cargadas por Prisma.
11. Convierta explícitamente fechas y tipos no JSON a representaciones públicas estables.
12. Preserve la semántica contractual de `null`, `undefined` y campos omitidos.
13. Mantenga los Mappers libres de I/O, reglas de negocio y decisiones de autorización.
14. No serialice directamente errores internos, errores de Prisma, `ZodError` ni stack traces hacia el cliente.
15. Verifique mediante E2E Tests los Response Contracts y la ausencia de campos sensibles.
