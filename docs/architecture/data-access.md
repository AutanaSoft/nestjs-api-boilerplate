# Acceso a datos

Este documento define la arquitectura de persistencia del proyecto.

El proyecto utiliza PostgreSQL como base de datos relacional predeterminada y Prisma como ORM.

## Límite de persistencia

Los Feature Modules acceden a la persistencia mediante Repositories.

Los Application Services no deben depender directamente de Prisma Client ni contener queries específicas de Prisma.

La dirección de dependencias predeterminada es:

```text
Service
   ↓
Repository
   ↓
Prisma
   ↓
PostgreSQL
```

Los Repositories encapsulan el comportamiento específico de persistencia y mantienen los detalles de implementación del
ORM fuera de los Application Services.

## Repository Ownership

Los Repositories pertenecen al Feature que posee los datos persistidos.

```text
src/modules/users/
└── repositories/
    └── users.repository.ts
```

Un Repository puede permanecer en la raíz del Feature mientras este sea pequeño y moverse a `repositories/` a medida que
el Feature crece.

Los Repositories normalmente deben permanecer privados para su módulo propietario.

Otros módulos deben consumir la Service API exportada por el Feature, en lugar de sus Repositories.

## Responsabilidades de los Repositories

Los Repositories son responsables de:

- queries de Prisma;
- relation loading;
- filtros y ordering;
- persistence projections;
- escrituras en la base de datos;
- persistence mapping cuando sea necesario;
- operaciones de persistencia conscientes de transactions.

Los Repositories deben exponer operaciones significativas para la aplicación, en lugar de exponer Prisma Client
directamente.

Por ejemplo:

```typescript
@Injectable()
export class UsersRepository {
  findById(id: string) {}

  findByEmail(email: string) {}

  create(input: CreateUserPersistenceInput) {}

  updateById(id: string, input: UpdateUserPersistenceInput) {}

  deleteById(id: string) {}
}
```

## Infraestructura de base de datos

La construcción y el lifecycle de Prisma Client pertenecen a la infraestructura de base de datos fuera de los Feature
Modules.

```text
src/
├── database/
└── modules/
```

Los Feature Repositories consumen la infraestructura de base de datos mediante dependency injection.

Los Application Services no deben inyectar Prisma Client directamente.

## Prisma Schema

El Prisma Schema y el historial de migrations se ubican fuera de `src`.

```text
prisma/
├── schema.prisma
└── migrations/
```

El Prisma Schema define el persistence model. No debe tratarse como el contrato de la aplicación o HTTP.

Los application inputs, application outputs y persistence records siguen siendo responsabilidades separadas.

## Migrations

Los cambios de schema de la base de datos deben versionarse mediante Prisma Migrate.

Los migration files forman parte del repositorio y deben revisarse junto con los cambios de aplicación que los requieren.

Los cambios de schema no deben depender de la modificación manual de bases de datos de producción.

`prisma db push` puede usarse para prototipado local cuando sea adecuado, pero no reemplaza el migration history para
cambios de aplicación destinados a versionarse en el repositorio.

## Transactions

Utilice transactions cuando una única operación de aplicación requiera múltiples escrituras en la base de datos que
deban tener éxito o fallar juntas.

El transaction ownership pertenece a la operación de aplicación que define el límite atómico.

Los Repositories que participan en esa operación deben ejecutarse mediante el mismo transaction context.

No cree transactions independientes dentro de los Repositories cuando hacerlo rompería una transaction de aplicación más
amplia.

## Relaciones y N+1 queries

Los Repositories son responsables de realizar relation loading de manera eficiente.

No cargue colecciones y luego ejecute una query a la base de datos por cada record para obtener datos relacionados.

Evite patrones equivalentes a:

```text
load users
   ↓
for each user
   ↓
load user relations
```

Prefiera relation queries que permitan a Prisma resolver los datos requeridos como parte de la operación del Repository.

Utilice `select` o `include` deliberadamente y solicite únicamente las relaciones requeridas por la operación de
aplicación.

Cuando se admita y sea adecuado, prefiera relation loading strategies que eviten round trips innecesarios a la base de
datos.

El comportamiento de las queries debe verificarse al trabajar con colecciones grandes o relaciones anidadas, en lugar de
asumir que la abstracción del ORM garantiza una ejecución óptima.

## Query scope

Los Repositories deben recuperar únicamente los datos requeridos por su caller.

Prefiera projections explícitas cuando una operación requiera un subconjunto de un model.

Evite cargar relational graphs completos de forma predeterminada.

El relation loading debe ser intencional y pertenecer a la operación del Repository responsable de la query.

## Raw SQL

Utilice de forma predeterminada la API normal de Prisma.

Raw SQL debe reservarse para casos en los que el comportamiento requerido de la base de datos no pueda expresarse con
claridad o eficiencia mediante la API habitual de Prisma.

Las Raw Queries deben permanecer dentro del límite de persistencia y usar APIs parametrizadas.

Los Application Services no deben contener Raw SQL.

## Contratos de persistencia

Las estructuras de persistencia no deben usarse directamente como HTTP input contracts o application input contracts.

Por ejemplo, un tipo de usuario generado por Prisma no debe convertirse en el Request contract para crear un usuario.

Las responsabilidades de aplicación y persistencia pueden compartir campos y, a la vez, seguir siendo contratos
separados.

Esto evita que los campos específicos de persistencia se conviertan involuntariamente en parte de la API pública de la
aplicación.

## Reglas

1. Utilice PostgreSQL como base de datos relacional predeterminada.
2. Utilice Prisma como ORM predeterminado.
3. Acceda a la persistencia mediante Repositories propiedad del Feature correspondiente.
4. Mantenga la lógica específica de Prisma dentro del límite de persistencia.
5. No inyecte Prisma Client directamente en los Application Services.
6. Mantenga los Repositories privados para su Feature de forma predeterminada.
7. Versione los cambios de la base de datos con Prisma Migrate.
8. Utilice shared transactions para operaciones que requieren persistencia atómica de varios pasos.
9. Prevenga N+1 queries diseñando el relation loading en el nivel del Repository.
10. Cargue únicamente los fields y relations requeridos por una operación.
11. Mantenga Raw SQL dentro de los Repositories y utilice APIs parametrizadas.
12. Mantenga los persistence models separados de los application contracts y transport contracts.
