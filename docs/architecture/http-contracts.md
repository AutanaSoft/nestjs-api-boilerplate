# Contratos HTTP

Este documento define las convenciones compartidas para los contratos HTTP de entrada y salida de la aplicación.

Los contratos HTTP son límites públicos de transporte y deben permanecer separados de los modelos internos de aplicación, persistencia e infraestructura.

## Alcance

Los contratos HTTP incluyen:

- Request Body;
- Query Params;
- Route Params;
- Headers con semántica de aplicación;
- Responses públicas;
- estructuras públicas de colección y metadata.

Las reglas específicas de entrada se definen en `validation.md` y las de salida en `serialization.md`.

## Schema-first

El proyecto utiliza Zod 4 como implementación principal de Standard Schema para contratos HTTP.

Cada contrato estructurado debe tener un Schema canónico y su Type debe derivarse de ese Schema.

```typescript
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
```

No mantenga un Type manual separado que pueda divergir del Schema.

## Ownership

Cada contrato debe tener un único owner canónico.

Los contratos específicos de un Feature pertenecen al Feature que posee el Endpoint. Los contratos genuinamente compartidos deben seguir teniendo un owner único y ser importados desde allí.

No redeclare Schemas equivalentes en varios módulos.

## Separación de responsabilidades

Los contratos HTTP, de aplicación y persistencia son responsabilidades distintas.

```text
HTTP Contract
    ↓
Application Contract
    ↓
Persistence Contract
```

Pueden compartir campos sin convertirse en el mismo contrato.

Los contratos HTTP no deben depender de Prisma ni de otros detalles de infraestructura.

## Prisma y persistencia

Los modelos y Types generados por Prisma no deben utilizarse directamente como Request o Response Contracts públicos.

Los campos persistidos forman parte del contrato HTTP únicamente cuando se incluyen deliberadamente en un Schema público.

## Composición

Componga Schemas canónicos cuando exista un owner reutilizable y la composición preserve la semántica del contrato.

No utilice Schemas de persistencia como base automática de contratos HTTP sólo para reducir duplicación.

## Nullability y ausencia

Modele explícitamente la diferencia entre propiedades ausentes y `null`.

Utilice:

- `optional()` cuando una propiedad pueda omitirse;
- `nullable()` cuando `null` sea válido;
- `nullish()` únicamente cuando ambas condiciones sean válidas.

## Transformaciones

Los Transforms y Refinements de Schemas HTTP deben ser puros y deterministas.

No deben realizar I/O, acceder a infraestructura ni ejecutar reglas de negocio dependientes de estado externo.

## Request y Response

Request y Response son contratos distintos aunque compartan campos.

```text
CreateUser Request Schema
          ≠
User Response Schema
          ≠
Prisma User Record
```

Cada contrato debe modelar únicamente su responsabilidad.

## Standard Schema en NestJS

La integración schema-first utiliza:

- `StandardSchemaValidationPipe` para Request validation;
- `StandardSchemaSerializerInterceptor` para Response serialization.

Los detalles de cada boundary se definen en sus documentos correspondientes.

La generación de documentación desde estos contratos se define en `../api/openapi.md`.

## Reglas

1. Utilice Zod 4 como implementación principal de Standard Schema para contratos HTTP.
2. Mantenga un único Schema canónico por contrato.
3. Derive y exporte el Type junto al Schema que lo define.
4. Mantenga un owner claro para contratos específicos y compartidos.
5. Mantenga separados los contratos HTTP, de aplicación y persistencia.
6. No utilice modelos o Types de Prisma directamente como contratos HTTP.
7. Mantenga I/O y reglas de negocio dependientes de estado fuera de los Schemas.
8. Componga Schemas sólo cuando se preserve su semántica y ownership.
9. Modele `optional`, `nullable` y `nullish` según la semántica pública real.
10. Mantenga Request Contracts y Response Contracts como responsabilidades distintas.
