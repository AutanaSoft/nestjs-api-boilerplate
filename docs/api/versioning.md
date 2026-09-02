# Versionado de API

Status: Target

Este documento define la estrategia de versionado del contrato HTTP público.

La estrategia estándar es **URI Versioning**.

## Convención

Las versiones forman parte de la URI:

```text
/api/v1
/api/v2
```

La versión inicial es:

```text
v1
```

Las versiones utilizan números enteros.

No utilice semantic versioning en rutas HTTP.

## Scope

El versionado aplica únicamente a cambios observables del contrato público, incluyendo:

- rutas;
- métodos HTTP;
- Request Contracts;
- Response Contracts;
- Status Codes;
- Headers públicos;
- requisitos públicos de autenticación o autorización;
- semántica observable de operaciones.

Los cambios internos que preserven compatibilidad no requieren una nueva versión.

## Breaking Changes

Debe introducirse una nueva versión cuando un cambio rompa compatibilidad con clientes existentes.

Ejemplos:

- eliminar o renombrar una operación;
- cambiar su método HTTP;
- eliminar o renombrar campos públicos;
- cambiar el tipo o significado de un campo;
- convertir un campo opcional en requerido;
- cambiar Status Codes contractuales;
- modificar de forma incompatible pagination, filtering o sorting;
- cambiar requisitos de acceso de forma incompatible.

Los cambios backward-compatible permanecen dentro de la versión existente.

## Coexistencia

Una nueva versión puede coexistir temporalmente con versiones anteriores:

```text
/api/v1/resource
/api/v2/resource
```

El periodo de coexistencia debe permitir una migración explícita de los clientes afectados.

## Deprecation

Una versión u operación no debe retirarse sin deprecation cuando existan consumidores que puedan depender de ella.

La deprecation debe:

- estar documentada;
- identificar la alternativa;
- indicar la fecha de retiro cuando sea conocida.

La especificación OpenAPI debe reflejar la deprecation correspondiente.

## Reglas

1. Utilice URI Versioning.
2. Utilice `/api/v1`, `/api/v2`, etc.
3. Utilice `v1` como versión inicial.
4. Utilice números enteros para versiones públicas.
5. Cree una nueva versión únicamente para breaking changes.
6. Mantenga cambios compatibles dentro de la versión existente.
7. Permita coexistencia temporal cuando sea necesaria para migración.
8. Documente deprecation antes de retirar contratos públicos en uso.
9. Mantenga OpenAPI consistente con las versiones publicadas.
