# Versionado de API

Status: Implemented

Este documento define la estrategia de versionado del contrato HTTP público.

La estrategia estándar es **URI Versioning**.

## Convención

Las versiones forman parte de la URI. El prefijo global predeterminado es `api`:

```text
/api/v1
/api/v2
```

`API_GLOBAL_PREFIX` puede establecerse en un path relativo normalizado, por ejemplo `platform/api`. Un valor vacío
explícito omite el prefijo y publica `v1` como `/v1`. Esta variable no determina dominios, hosts ni autorización; el
proxy o ingress conserva o reescribe el path antes de entregarlo a NestJS.

La versión inicial es `1`, expuesta en la URI como:

```text
v1
```

Cada controlador público declara esta versión explícitamente. `APP_VERSION` identifica el software y no modifica las
rutas HTTP. No existe una variable `API_VERSION` de entorno.

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

La especificación OpenAPI debe reflejar la deprecation correspondiente cuando se implemente su integración; OpenAPI
permanece fuera del alcance de este cambio.

## Reglas

1. Utilice URI Versioning.
2. Publique cada versión como `/<prefijo-configurado>/vN` o `/vN` cuando el prefijo esté vacío.
3. Utilice `1` como identificador de la versión inicial, expuesto como `v1` en la URI.
4. Utilice números enteros para versiones públicas.
5. Cree una nueva versión únicamente para breaking changes.
6. Mantenga cambios compatibles dentro de la versión existente.
7. Permita coexistencia temporal cuando sea necesaria para migración.
8. Documente deprecation antes de retirar contratos públicos en uso.
9. Mantenga OpenAPI consistente con las versiones publicadas cuando se implemente su integración.
