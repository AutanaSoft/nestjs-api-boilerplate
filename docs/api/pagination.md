# Paginación

Status: Target

Este documento define la convención compartida de paginación de la API.

La estrategia estándar es **bidirectional cursor pagination**.

## Request Contract

La entrada utiliza:

| Campo | Semántica |
| --- | --- |
| `limit` | Cantidad máxima de elementos solicitados |
| `after` | Cursor para navegación hacia adelante |
| `before` | Cursor para navegación hacia atrás |

Convenciones:

```text
default limit = 25
maximum limit = 250
```

`after` y `before` son mutuamente excluyentes.

Los cursors deben ser opacos para el cliente.

Las convenciones generales de contratos se definen en `http-contracts.md`.

## Response Contract

Las Responses paginadas utilizan:

```typescript
type PaginatedResponse<T> = {
  data: T[];
  pageInfo: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

`data` contiene los recursos de la página actual.

`pageInfo` contiene únicamente la información necesaria para navegar entre páginas.

## Ordering

Cursor pagination requiere ordering determinista.

Cuando el criterio principal no sea único, debe utilizarse un tie-breaker único.

Los cursors deben corresponder al mismo filtering y sorting que originaron la consulta.

## Reglas

1. Utilice bidirectional cursor pagination como estrategia estándar.
2. Utilice `after` y `before` para navegación.
3. No permita ambos cursors simultáneamente.
4. Utilice `25` como limit predeterminado.
5. Utilice `250` como limit máximo.
6. Utilice `{ data, pageInfo }` como Response estándar.
7. Incluya `nextCursor`, `previousCursor`, `hasNextPage` y `hasPreviousPage`.
8. Mantenga los cursors opacos.
9. Utilice ordering determinista.
10. No incluya offsets, page numbers ni totals en el contrato estándar.
