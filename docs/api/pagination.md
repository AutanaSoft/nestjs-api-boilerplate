# Paginación

Status: Target

Este documento define la convención compartida de paginación de la API.

La estrategia estándar es **bidirectional cursor pagination**.

## Request Contract

La entrada utiliza:

| Campo    | Semántica                                |
| -------- | ---------------------------------------- |
| `limit`  | Cantidad máxima de elementos solicitados |
| `after`  | Cursor para navegación hacia adelante    |
| `before` | Cursor para navegación hacia atrás       |

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

Los clientes deberían reutilizar los cursors con el mismo filtering y sorting que originaron la consulta. Un cursor
incluye una versión y se valida como entrada no confiable; debe rechazarse si está malformado, supera 1024 caracteres o
es incompatible con la consulta. No requiere firma cuando no transporte permisos ni datos secretos.

En Users, el cursor v1 contiene únicamente `v`, `sort`, `direction` y `position`. No contiene valores crudos de filtros
ni codifica o verifica compatibilidad con `email`; por lo tanto, un cursor obtenido con un filtro de email puede
reutilizarse con otro filtro de email y el repositorio aplica el filtro de la solicitud actual. Esto se acepta por
diseño: omitir el filtro mejora la privacidad del token, pero sacrifica la validación de compatibilidad entre emails y
no proporciona autenticidad ni firma. Los cursores v1 antiguos que contienen `email` se rechazan por el schema estricto.

`hasNextPage` y `hasPreviousPage` describen filas reales adyacentes a la página devuelta. Los cursores correspondientes
son `null` cuando no existe esa página adyacente. Una página vacía devuelve ambos flags en `false` y ambos cursores en
`null`.

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
11. Rechace parámetros desconocidos, repetidos o con valores no soportados.
12. Emita cursores sólo para páginas adyacentes reales.
