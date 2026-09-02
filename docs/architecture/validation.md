# Validación

Este documento define las convenciones para validar datos que ingresan a la aplicación a través del límite HTTP.

Las reglas compartidas de ownership, Schema/Type y separación de contratos se definen en `http-contracts.md`.

## Límite de entrada

Todo dato externo debe tratarse como no confiable hasta haber sido validado.

Esto incluye, según corresponda:

- Request Body;
- Query Params;
- Route Params;
- Headers con semántica de aplicación.

La validación debe ocurrir antes de delegar datos a un Service.

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

Los Services deben recibir valores ya validados y normalizados respecto al contrato HTTP.

## StandardSchemaValidationPipe

El proyecto utiliza `StandardSchemaValidationPipe` como mecanismo predeterminado para Request validation schema-first con Zod 4.

```typescript
app.useGlobalPipes(
  new StandardSchemaValidationPipe({
    transform: true,
  }),
);
```

Los Schemas pueden asociarse directamente a parámetros HTTP.

```typescript
@Post()
create(@Body({ schema: createUserSchema }) body: CreateUserInput) {
  return this.usersService.create(body);
}
```

Cuando el Schema aplique coercion o Transform, el Controller debe recibir el valor producido por el Schema.

## Request Schemas

Cada input HTTP debe utilizar un Schema que modele únicamente los campos aceptados por el contrato correspondiente.

```typescript
export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
```

Query Params y Route Params pueden utilizar coercion cuando sea necesaria por su representación externa.

```typescript
export const listUsersQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
});
```

No utilice `z.coerce` en Schemas que modelen datos internos ya tipados.

## Refinements y Transforms

Los Refinements y Transforms deben permanecer puros y deterministas.

Pueden validar relaciones entre valores del propio input, pero no deben:

- consultar la base de datos;
- invocar servicios externos;
- ejecutar autorización;
- depender de estado mutable externo.

Las reglas que requieran estado de aplicación pertenecen al caso de uso, no al Request Schema.

## Campos y límites

Cada Request Schema debe definir deliberadamente:

- campos aceptados;
- formatos;
- rangos;
- longitudes;
- nullability y optionality;
- límites específicos del contrato.

Los límites pertenecientes a convenciones compartidas, como pagination, deben seguir su documento owner en lugar de redefinirse localmente.

## parse y safeParse

Fuera de la integración automática del Pipe, elija deliberadamente entre `parse` y `safeParse`.

Utilice `parse` cuando el input inválido deba abortar el flujo y `safeParse` cuando el caller necesite inspeccionar el resultado.

## Errores de validación

Los errores producidos por Zod o Standard Schema no deben exponerse directamente.

Deben traducirse al Error Response global según `error-handling.md`.

Los errores estructurales de Request utilizan `400 Bad Request`.

## Reglas

1. Trate todo input externo como no confiable hasta validarlo.
2. Utilice `StandardSchemaValidationPipe` como mecanismo predeterminado de Request validation.
3. Utilice Zod 4 Schemas compatibles con Standard Schema para contratos HTTP de entrada.
4. Valide y normalice el input antes de delegarlo a Services.
5. Limite coercion a boundaries externos.
6. Mantenga Refinements y Transforms libres de I/O, autorización y estado externo.
7. Defina deliberadamente campos, formatos, límites, optionality y nullability.
8. Mantenga convenciones compartidas, como pagination, bajo su documento owner.
9. Elija `parse` o `safeParse` deliberadamente cuando valide fuera del Pipe.
10. Traduzca Validation Errors mediante el Error Boundary global.
