# Paginación

Este documento define la convención de paginación utilizada por la API.

La estrategia estándar es **bidirectional cursor pagination**.

## Request Contract

La entrada de paginación utiliza:

- `limit`;
- `after`;
- `before`.

```typescript
export const cursorPaginationSchema = z
  .object({
    limit: z.coerce.number().int().positive().max(250).default(25),
    after: z.string().min(1).optional(),
    before: z.string().min(1).optional(),
  })
  .refine(({ after, before }) => !(after && before), {
    message: '`after` and `before` cannot be used together',
  });

export type CursorPaginationInput = z.infer<
  typeof cursorPaginationSchema
>;
```

Convenciones:

```text
default limit = 25
maximum limit = 250
```

`after` y `before` son mutuamente excluyentes.

Los cursors deben ser opacos para el cliente y no deben exponer directamente estructuras de Prisma ni detalles de persistencia.

## Response Contract

Las Responses paginadas deben utilizar:

```typescript
export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  previousCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type PageInfo = z.infer<typeof pageInfoSchema>;
```

El contrato paginado debe utilizar la estructura:

```typescript
export const createPaginatedResponseSchema = <
  T extends z.ZodType,
>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    pageInfo: pageInfoSchema,
  });
```

Conceptualmente:

```typescript
export type PaginatedResponse<T> = {
  data: T[];
  pageInfo: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

## Ordering

Cursor pagination requiere un ordering determinista.

Cuando el campo principal de sorting no garantice unicidad, debe incluirse un tie-breaker único.

Por ejemplo:

```text
createdAt DESC
id DESC
```

Los cursors deben corresponder al mismo filtering y sorting que originaron la consulta.

## Reglas

1. Utilice bidirectional cursor pagination como estrategia estándar.
2. Utilice `after` y `before` como cursors de navegación.
3. No permita `after` y `before` simultáneamente.
4. Utilice `limit = 25` por defecto.
5. Utilice `250` como límite máximo.
6. Utilice `{ data, pageInfo }` como Response estándar.
7. Incluya `nextCursor`, `previousCursor`, `hasNextPage` y `hasPreviousPage` en `pageInfo`.
8. Mantenga los cursors opacos e independientes de Prisma.
9. Utilice ordering determinista.
10. No incluya offset, page numbers ni totals como parte del contrato estándar.
