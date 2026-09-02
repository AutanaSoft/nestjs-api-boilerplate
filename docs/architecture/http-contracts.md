# Contratos HTTP

Este documento define las convenciones compartidas para los contratos HTTP de entrada y salida de la aplicación.

Los contratos HTTP son límites públicos de transporte. Deben permanecer explícitos, versionables y separados de los
modelos internos de aplicación, persistencia e infraestructura.

## Alcance

Los contratos HTTP incluyen:

- Request Body;
- Query Params;
- Route Params;
- Headers utilizados como entrada de aplicación;
- Responses públicas;
- estructuras de colección y metadata pública asociada.

Las reglas específicas de entrada se definen en `validation.md`.

Las reglas específicas de salida se definen en `serialization.md`.

## Schema-first

El proyecto utiliza Zod 4 como implementación principal de Standard Schema para contratos HTTP.

Cada contrato público debe estar gobernado por un Schema canónico cuando su forma sea estructurada y estable.

```typescript
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
```

El Schema es la fuente canónica del contrato. El Type debe derivarse del Schema y exportarse desde el mismo owner.

No mantenga un Type manual separado que pueda divergir del Schema.

## Ownership

Cada contrato compartido debe tener un único owner canónico.

Los contratos específicos de un Feature pertenecen al Feature que posee el Endpoint correspondiente.

Una estructura habitual puede ser:

```text
src/modules/users/
├── dto/
│   ├── create-user.schema.ts
│   ├── update-user.schema.ts
│   ├── user-response.schema.ts
│   └── user-list-response.schema.ts
└── users.controller.ts
```

Cuando un contrato sea compartido entre varios Features, debe seguir teniendo un único owner. Los consumidores deben
importarlo desde allí en lugar de redeclararlo.

No duplique Schemas equivalentes en varios módulos.

## Separación de responsabilidades

Los contratos HTTP, los contratos de aplicación y los records de persistencia son responsabilidades distintas.

Pueden compartir campos sin convertirse en el mismo contrato.

```text
HTTP Contract
    ↓
Application Contract
    ↓
Persistence Contract
```

Los contratos HTTP no deben depender de Prisma, clientes HTTP, loggers, transacciones, conexiones de base de datos ni
otros detalles de infraestructura.

## Prisma y persistencia

Los modelos y Types generados por Prisma no deben utilizarse directamente como contratos HTTP públicos.

No utilice un record de persistencia como DTO de entrada ni como Response Contract por conveniencia.

Esto evita que cambios internos de base de datos modifiquen accidentalmente la API pública.

Los campos internos como IDs técnicos adicionales, hashes, timestamps internos, metadata de seguridad o relaciones
persistidas no forman parte del contrato HTTP salvo que sean incluidos explícitamente.

## Composición

Prefiera componer Schemas canónicos existentes cuando varios contratos compartan estructura y la composición preserve la
semántica de cada contrato.

No copie manualmente campos comunes cuando exista un Schema reutilizable propiedad de un owner claro.

La reutilización no debe borrar límites arquitectónicos. Un Schema de persistencia no debe convertirse en la base
automática de un contrato HTTP sólo para reducir duplicación.

## Nullability y ausencia

La diferencia entre ausencia, `undefined` y `null` debe modelarse explícitamente.

Utilice:

- `optional()` cuando una propiedad pueda omitirse;
- `nullable()` cuando `null` sea un valor válido;
- `nullish()` únicamente cuando ambas condiciones sean válidas.

La semántica debe reflejar el contrato público y no detalles accidentales de la representación interna.

## Transformaciones

Los Schemas pueden incluir transformaciones puras cuando formen parte del contrato.

Los Transforms y Refinements no deben realizar I/O, acceder a infraestructura ni ejecutar reglas de negocio dependientes
de estado externo.

Las transformaciones que requieran contexto de aplicación deben resolverse fuera del Schema.

## Contratos de entrada y salida

Request y Response son contratos distintos aunque compartan campos.

Por ejemplo, un Request para crear un usuario no debe derivarse automáticamente del Response público ni del record de
persistencia.

```text
CreateUser Request Schema
          ≠
User Response Schema
          ≠
Prisma User Record
```

Cada uno debe modelar únicamente su responsabilidad.

## Standard Schema en NestJS

NestJS 12 permite utilizar Schemas compatibles con Standard Schema directamente en los límites HTTP.

El proyecto utiliza:

- `StandardSchemaValidationPipe` para Request validation;
- `StandardSchemaSerializerInterceptor` para Response serialization.

Esto mantiene una arquitectura schema-first consistente entre entrada y salida.

## OpenAPI

Los mismos Schemas HTTP deben poder servir como fuente para la documentación OpenAPI cuando la integración lo permita.

No mantenga manualmente una segunda definición del mismo contrato sólo para documentación.

Las reglas específicas de generación y publicación de OpenAPI se definirán en su documento correspondiente.

## Testing

Los contratos deben probarse en el nivel práctico más pequeño.

Los Schemas complejos pueden tener Unit Tests directos.

Los E2E Tests deben verificar el comportamiento observable del contrato HTTP, incluyendo input inválido, Response shape y
ausencia de campos prohibidos.

## Reglas

1. Utilice Zod 4 como implementación principal de Standard Schema para contratos HTTP.
2. Mantenga un único Schema canónico por contrato compartido.
3. Derive y exporte el Type junto al Schema que lo define.
4. Mantenga los contratos HTTP bajo el ownership del Feature que posee el Endpoint, salvo contratos genuinamente compartidos.
5. Mantenga separados los contratos HTTP, de aplicación y persistencia.
6. No utilice modelos o Types de Prisma directamente como contratos HTTP.
7. Mantenga infraestructura, I/O y reglas de negocio dependientes de estado fuera de los Schemas.
8. Componga Schemas existentes cuando exista un owner canónico reutilizable y se preserve la semántica del contrato.
9. Modele `optional`, `nullable` y `nullish` según la semántica pública real.
10. Mantenga Request Contracts y Response Contracts como responsabilidades distintas.
11. Utilice Standard Schema como integración schema-first con los límites HTTP de NestJS.
12. Evite definiciones duplicadas del mismo contrato para runtime, Types y documentación.
