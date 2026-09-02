# Acceso a datos

Status: Target

Este documento define la arquitectura de persistencia de la aplicación.

PostgreSQL es la base de datos relacional predeterminada y Prisma es el ORM predeterminado.

La ubicación estructural de Features e infraestructura se define en `project-structure.md`.

## Límite de persistencia

Los Application Services acceden a persistencia mediante Repositories.

```text
Service
   ↓
Repository
   ↓
Prisma
   ↓
PostgreSQL
```

Los Services no deben depender directamente de Prisma Client ni contener queries específicas del ORM.

## Repository Ownership

Cada Repository pertenece al Feature propietario de los datos y comportamiento persistente correspondiente.

Los Repositories deben permanecer privados para su Feature salvo que exista una razón arquitectónica explícita para
exponerlos.

Otros Features deben consumir la API exportada por el módulo propietario, no sus Repositories.

## Responsabilidad de los Repositories

Los Repositories encapsulan las operaciones específicas de persistencia, incluyendo cuando corresponda:

- queries;
- relation loading;
- filtering y ordering;
- persistence projections;
- escrituras;
- persistence mapping;
- participación en transactions.

Deben exponer operaciones significativas para la aplicación en lugar de exponer Prisma Client directamente.

## Infraestructura de base de datos

La creación y lifecycle de Prisma Client pertenecen a la infraestructura de base de datos.

Los Repositories consumen esa infraestructura mediante dependency injection.

Los Application Services no deben inyectar Prisma Client directamente.

## Prisma Schema y Migrations

El Prisma Schema define el persistence model y permanece separado de los contratos de aplicación y transporte.

Los cambios de schema deben versionarse mediante Prisma Migrate.

El migration history forma parte del repositorio y debe mantenerse junto con los cambios que lo requieren.

`prisma db push` puede utilizarse para prototipado local, pero no sustituye las migrations versionadas.

## Transactions

Utilice transactions cuando una operación requiera múltiples cambios persistentes que deban completarse o fallar como
una unidad.

El transaction boundary pertenece a la operación de aplicación que define esa atomicidad.

Los Repositories participantes deben poder utilizar el mismo transaction context.

No cree transactions internas que impidan una transaction de aplicación más amplia.

## Relaciones y N+1

Los Repositories son responsables de diseñar relation loading eficiente.

Evite ejecutar queries adicionales por cada elemento de una colección cuando los datos puedan recuperarse mediante una
estrategia de carga adecuada.

Utilice `select`, `include` y las estrategias de relation loading deliberadamente según los datos requeridos.

## Query Scope

Recupere únicamente los fields y relations necesarios para la operación.

Evite cargar relational graphs completos por defecto.

Las projections y relation loading deben pertenecer a la operación del Repository responsable.

## Raw SQL

Utilice la API de Prisma por defecto.

Reserve Raw SQL para operaciones que no puedan expresarse con claridad o eficiencia mediante la API normal.

Las Raw Queries deben:

- permanecer dentro del límite de persistencia;
- utilizar APIs parametrizadas.

Los Application Services no deben contener Raw SQL.

## Contratos de persistencia

Los persistence models no deben convertirse implícitamente en contratos de aplicación o transporte.

La separación respecto al contrato HTTP público se define en `../api/http-contracts.md`.

## Reglas

1. Utilice PostgreSQL como base de datos relacional predeterminada.
2. Utilice Prisma como ORM predeterminado.
3. Acceda a persistencia mediante Repositories propiedad del Feature.
4. Mantenga Prisma y las queries específicas del ORM dentro del límite de persistencia.
5. No inyecte Prisma Client directamente en Application Services.
6. Mantenga los Repositories privados para su Feature por defecto.
7. Versione cambios de schema mediante Prisma Migrate.
8. Comparta el transaction context cuando una operación requiera atomicidad entre varios Repositories.
9. Evite N+1 queries mediante relation loading deliberado.
10. Recupere únicamente los datos requeridos.
11. Mantenga Raw SQL parametrizado dentro del límite de persistencia.
12. Mantenga persistence models separados de contratos de aplicación y transporte.
