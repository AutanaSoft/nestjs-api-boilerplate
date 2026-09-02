# Validación

Este documento define las convenciones de validación para datos que ingresan a la aplicación a través del límite HTTP.

Las reglas compartidas de ownership, Schema/Type, separación de contratos y Standard Schema se definen en
`http-contracts.md`.

## Límite de entrada

Todo dato externo debe tratarse como no confiable hasta haber sido validado.

En una API HTTP esto incluye, según corresponda:

- Request Body;
- Query Params;
- Route Params;
- Headers utilizados como entrada de aplicación.

La validación debe ocurrir antes de que un Controller delegue datos a un Service.

```text
HTTP Request
    ↓
StandardSchemaValidationPipe
    ↓
Request Schema
    ↓
Typed Input
    ↓
Controller
    ↓
Service
```

Los Services deben recibir valores ya validados y tipados. No deben repetir la validación estructural propia del límite
HTTP.

## StandardSchemaValidationPipe

El proyecto utiliza `StandardSchemaValidationPipe` como mecanismo predeterminado para Request validation schema-first con
Zod 4.

El Pipe debe registrarse en el bootstrap compartido cuando la validación de Standard Schema sea una convención global de
la aplicación.

```typescript
app.useGlobalPipes(
  new StandardSchemaValidationPipe({
    transform: true,
  }),
);
```

Los Schemas pueden asociarse directamente a los decoradores de parámetros de NestJS.

```typescript
@Post()
create(@Body({ schema: createUserSchema }) body: CreateUserInput) {
  return this.usersService.create(body);
}
```

```typescript
@Get(':id')
findOne(
  @Param('id', { schema: z.uuid() }) id: string,
) {
  return this.usersService.findById(id);
}
```

Cuando el Schema realice coercion o Transform, el valor entregado al Controller debe ser el valor producido por el
Schema.

## Request Body

Cada Request Body debe validarse mediante un Schema específico del caso de uso.

```typescript
export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
```

No acepte campos internos sólo porque existan en modelos de aplicación o persistencia.

Los detalles sobre ownership y separación respecto a Prisma se definen en `http-contracts.md`.

## Query Params y Route Params

Query Params y Route Params llegan como representaciones externas y pueden requerir normalización o coercion.

La coercion debe limitarse al límite de entrada.

```typescript
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
```

Después de la validación, la lógica interna debe trabajar con valores ya normalizados.

No utilice `z.coerce` en Schemas que modelen datos internos ya tipados.

## Headers

Valide Headers únicamente cuando formen parte del input real de aplicación.

No convierta todos los Headers HTTP en contratos de dominio.

Headers como idempotency keys, filtros condicionales u otros valores con semántica de aplicación deben pasar por un
Schema antes de ser utilizados por la lógica interna.

## parse y safeParse

Fuera de la integración automática del Pipe, el uso de `parse` o `safeParse` debe ser deliberado.

Utilice `parse` cuando el input inválido deba abortar inmediatamente el flujo.

Utilice `safeParse` cuando el caller necesite inspeccionar explícitamente el resultado y decidir cómo manejar el fallo.

No trate el resultado de `parse` como un objeto `success/data/error`.

## Refinements y Transforms

Los Refinements y Transforms utilizados en Request Schemas deben permanecer puros y deterministas.

Pueden validar relaciones internas entre valores recibidos, pero no deben:

- consultar la base de datos;
- invocar APIs externas;
- leer estado mutable;
- ejecutar autorización;
- coordinar reglas de negocio dependientes de infraestructura.

Por ejemplo, comprobar que dos campos de contraseña coincidan puede pertenecer al Schema; comprobar si un email ya
existe pertenece al Service.

## Unknown fields

Cada Request Schema debe definir de forma deliberada qué propiedades acepta.

No permita que campos arbitrarios lleguen a Services o Repositories simplemente porque el cliente los envió.

La política concreta de propiedades desconocidas debe ser coherente con Zod y con el contrato del Endpoint. Un campo no
definido por el Request Contract no debe convertirse accidentalmente en input de persistencia.

## Límites de entrada

Los Schemas deben aplicar límites razonables cuando la naturaleza del campo lo requiera.

Esto incluye, según corresponda:

- longitud mínima y máxima de strings;
- tamaño máximo de arrays;
- rangos numéricos;
- formatos de UUID, URL o email;
- límites de paginación;
- enums o discriminated unions.

Los límites de payload HTTP globales pertenecen a la configuración HTTP, no al Schema de un caso de uso individual.

## Errores de validación

Los errores producidos por Standard Schema o Zod no deben exponerse directamente como detalles internos.

La aplicación debe traducirlos al contrato HTTP global de errores.

El error público debe conservar información útil para identificar el input inválido sin exponer stack traces ni detalles
internos del framework o de la librería.

La forma exacta se define en `error-handling.md`.

## Testing

Los Request Schemas pueden probarse directamente cuando contengan comportamiento estructural relevante.

Los E2E Tests deben verificar que inputs inválidos sean rechazados a través del límite HTTP real y que no alcancen
exitosamente la operación de aplicación.

Deben cubrirse especialmente:

- coercion relevante;
- campos requeridos;
- formatos inválidos;
- límites máximos y mínimos;
- semántica de campos opcionales y nullable;
- errores de Request públicos.

## Reglas

1. Trate todo input externo como no confiable hasta validarlo.
2. Utilice `StandardSchemaValidationPipe` como mecanismo predeterminado para Request validation schema-first.
3. Utilice Zod 4 Schemas compatibles con Standard Schema en Request Body, Query Params y Route Params.
4. Valide el input antes de delegarlo a Services.
5. Entregue a la aplicación el valor normalizado producido por el Schema.
6. Limite coercion y normalización a límites externos.
7. Valide Headers únicamente cuando tengan semántica de aplicación.
8. Mantenga Refinements y Transforms libres de I/O, autorización y reglas de negocio dependientes de infraestructura.
9. Defina deliberadamente campos aceptados, formatos y límites de cada Request Contract.
10. Elija `parse` o `safeParse` deliberadamente cuando valide fuera del Pipe.
11. Traduzca errores de validación al contrato HTTP global de errores.
12. Verifique el comportamiento público de Request validation mediante E2E Tests.
