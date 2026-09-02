# Validación

Este documento define las convenciones de validación para los límites HTTP de la aplicación.

El proyecto utiliza Zod 4 como mecanismo principal para validar y tipar datos externos antes de que ingresen a la lógica
de aplicación.

## Límite de validación

Todo dato proveniente de una fuente externa debe tratarse como no confiable hasta haber sido validado.

En una API HTTP esto incluye, según corresponda:

- Request Body;
- Query Params;
- Route Params;
- Headers utilizados como entrada de aplicación;
- payloads recibidos desde servicios externos.

La validación debe ocurrir en el límite de entrada antes de que un Controller delegue datos a un Service.

```text
HTTP Request
    ↓
Validation Boundary
    ↓
Typed Input
    ↓
Controller
    ↓
Service
```

Los Services deben recibir valores ya validados y tipados. No deben repetir la validación estructural propia del límite
HTTP.

## Ownership de schemas

Cada contrato Zod debe tener un único owner canónico.

Los schemas específicos de un Feature pertenecen al Feature que posee el límite correspondiente.

Una estructura habitual puede ser:

```text
src/modules/users/
├── dto/
│   ├── create-user.schema.ts
│   ├── update-user.schema.ts
│   └── list-users-query.schema.ts
└── users.controller.ts
```

Cuando un contrato sea compartido por varios consumidores, debe seguir teniendo un único owner y los demás módulos deben
importarlo desde allí en lugar de redeclararlo.

No duplique schemas equivalentes en distintos Features.

## Schema y Type

El owner de un schema también debe derivar y exportar su Type.

```typescript
export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

Los consumidores deben importar tanto el schema como el Type desde su owner canónico cuando los necesiten.

No vuelva a inferir localmente un Type perteneciente a otro módulo.

## Request Body

El Request Body debe validarse mediante un schema específico del caso de uso.

No utilice modelos de Prisma, records de persistencia ni tipos generados por el ORM como DTO de entrada HTTP.

Por ejemplo, la creación de un usuario debe definir un contrato de entrada independiente de su representación persistida:

```typescript
export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
```

Los campos internos de persistencia, como `id`, timestamps, hashes o metadata de seguridad, no deben convertirse en input
público sólo porque existan en el modelo de base de datos.

## Query Params y Route Params

Query Params y Route Params llegan al límite HTTP como representaciones externas y pueden requerir normalización o
coercion.

La coercion debe limitarse al límite de entrada.

Por ejemplo:

```typescript
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
```

Después de la validación, la lógica interna debe trabajar con tipos ya normalizados y no coercivos.

No utilice `z.coerce` en schemas que modelan datos internos que ya poseen un Type definido.

## Optional, Nullable y Nullish

La ausencia y `null` deben modelarse explícitamente.

Utilice:

- `optional()` cuando el campo pueda omitirse;
- `nullable()` cuando `null` sea un valor permitido;
- `nullish()` únicamente cuando tanto la omisión como `null` sean estados válidos.

No use `nullable()` para representar simplemente un campo opcional.

Esto es especialmente importante en operaciones `PATCH`, donde omitir una propiedad y establecerla explícitamente en
`null` pueden representar operaciones distintas.

## parse y safeParse

El uso de `parse` o `safeParse` debe ser deliberado.

Utilice `parse` cuando una entrada inválida deba abortar inmediatamente el flujo y el mecanismo de validación sea
responsable de traducir el error.

Utilice `safeParse` cuando el caller necesite inspeccionar el resultado de validación y decidir explícitamente cómo
traducir o manejar el fallo.

No trate el resultado de `parse` como si fuera un objeto `success/data/error`.

## Refinements y Transforms

Los Refinements y Transforms deben permanecer puros y deterministas.

Un Refinement puede validar relaciones internas entre los valores recibidos, pero no debe:

- consultar la base de datos;
- invocar APIs externas;
- leer estado mutable;
- coordinar reglas de negocio dependientes de infraestructura.

Por ejemplo, validar que dos campos de contraseña coincidan puede pertenecer al schema; comprobar si un email ya existe
en la base de datos pertenece al Service correspondiente.

```text
Schema
    ↓
Validación estructural y determinista

Service
    ↓
Reglas de negocio e I/O
```

## Composición de schemas

Prefiera componer schemas existentes cuando varios contratos compartan una estructura canónica.

No copie manualmente campos comunes cuando exista un schema propietario reutilizable y la composición preserve la
semántica del contrato.

La reutilización no debe eliminar límites importantes entre contratos distintos. Un schema de persistencia no debe
convertirse en la base automática de un DTO HTTP sólo para evitar duplicación de campos.

## Separación de persistencia

Los contratos HTTP, los contratos de aplicación y los records de persistencia son responsabilidades distintas.

Pueden compartir campos, pero no deben ser tratados como el mismo contrato.

```text
HTTP Input Schema
       ↓
Application Input
       ↓
Service
       ↓
Repository Input
       ↓
Prisma
```

Esta separación evita que campos internos de persistencia se conviertan accidentalmente en parte de la API pública.

## Errores de validación

Los errores de Zod no deben exponerse directamente como detalles internos sin una traducción controlada al contrato HTTP
de errores de la aplicación.

La forma pública del error será definida por la convención global de manejo de errores.

El límite de validación debe conservar suficiente información para identificar qué campo o parte del input fue inválido,
sin exponer información interna innecesaria.

## Testing

La validación debe cubrirse en el nivel práctico más pequeño.

Los schemas pueden probarse directamente para casos estructurales complejos. Los Endpoints deben verificarse mediante E2E
cuando el comportamiento público de validación forme parte del contrato HTTP.

Las pruebas E2E deben incluir casos relevantes de input inválido y verificar que el Request no alcance exitosamente la
operación cuando el contrato no se cumpla.

## Reglas

1. Trate todo input externo como no confiable hasta validarlo.
2. Utilice Zod 4 para validar los contratos de entrada definidos por el proyecto.
3. Valide Request Body, Query Params y Route Params en el límite HTTP antes de delegar a Services.
4. Asigne un único owner canónico a cada schema compartido.
5. Derive y exporte el Type junto al schema que lo define.
6. Mantenga separados los contratos HTTP, de aplicación y de persistencia.
7. No utilice modelos de Prisma ni records de persistencia como DTOs de entrada HTTP.
8. Limite `z.coerce` a límites de entrada externos.
9. Modele `optional`, `nullable` y `nullish` de forma explícita según la semántica real del contrato.
10. Elija `parse` o `safeParse` según el comportamiento de error requerido por el caller.
11. Mantenga Refinements y Transforms puros, deterministas y libres de I/O.
12. Mantenga las reglas de negocio dependientes de infraestructura fuera de los schemas.
13. Componga schemas existentes cuando exista un owner canónico reutilizable y la composición preserve los límites del contrato.
14. Traduzca los errores de Zod al contrato HTTP de errores de la aplicación en lugar de exponerlos directamente.
