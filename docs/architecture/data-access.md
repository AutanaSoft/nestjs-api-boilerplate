# Acceso a datos

Este documento define la arquitectura de persistencia para el Boilerplate de API de NestJS.

El proyecto utiliza PostgreSQL como base de datos relacional predeterminada y Prisma como su ORM.

## Límite de persistencia

Los módulos de funcionalidades acceden a la persistencia mediante repositorios.

Los servicios de aplicación no deben depender directamente de Prisma Client ni contener consultas específicas de Prisma.

La dirección de dependencias predeterminada es:

```text
Servicio
   ↓
Repositorio
   ↓
Prisma
   ↓
PostgreSQL
```

Los repositorios son propietarios del comportamiento específico de persistencia y mantienen los detalles de
implementación de ORM fuera de los servicios de aplicación.

## Propiedad de los repositorios

Los repositorios pertenecen a la funcionalidad que posee los datos persistidos.

```text
src/modules/users/
└── repositories/
    └── users.repository.ts
```

Un repositorio puede permanecer en la raíz de la funcionalidad mientras esta sea pequeña y moverse a `repositories/` a
medida que la funcionalidad crece.

Los repositorios normalmente deben permanecer privados para su módulo propietario.

Otros módulos deben consumir la API de servicio exportada por la funcionalidad, en lugar de sus repositorios.

## Responsabilidades de los repositorios

Los repositorios son responsables de:

- consultas de Prisma;
- carga de relaciones;
- filtros y ordenamiento;
- proyecciones específicas de persistencia;
- escrituras en la base de datos;
- mapeo de persistencia cuando sea necesario;
- operaciones de persistencia conscientes de transacciones.

Los repositorios deben exponer operaciones significativas para la aplicación, en lugar de exponer Prisma Client
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

La construcción y el ciclo de vida del cliente de Prisma pertenecen a la infraestructura de base de datos fuera de los
módulos de funcionalidades.

```text
src/
├── database/
└── modules/
```

Los repositorios de funcionalidades consumen la infraestructura de base de datos mediante inyección de dependencias.

Los servicios de aplicación no deben inyectar el cliente de Prisma directamente.

## Esquema de Prisma

El esquema de Prisma y el historial de migraciones se ubican fuera de `src`.

```text
prisma/
├── schema.prisma
└── migrations/
```

El esquema de Prisma define el modelo de persistencia. No debe tratarse como el contrato de la aplicación o HTTP.

Las entradas, salidas y registros de persistencia de la aplicación siguen siendo responsabilidades separadas.

## Migraciones

Los cambios de esquema de la base de datos deben versionarse mediante Prisma Migrate.

Los archivos de migración son parte del repositorio y deben revisarse junto con los cambios de aplicación que los
requieren.

Los cambios de esquema no deben depender de la modificación manual de bases de datos de producción.

`prisma db push` puede usarse para prototipado local cuando sea adecuado, pero no reemplaza el historial de migraciones
para cambios de aplicación destinados a confirmarse en el repositorio.

## Transacciones

Utilice transacciones cuando una única operación de aplicación requiera múltiples escrituras en la base de datos que
deban tener éxito o fallar juntas.

La propiedad de la transacción pertenece a la operación de aplicación que define el límite atómico.

Los repositorios que participan en esa operación deben ejecutarse mediante el mismo contexto de transacción.

No cree transacciones independientes dentro de los repositorios cuando hacerlo rompería una transacción de aplicación
más amplia.

## Relaciones y consultas N+1

Los repositorios son responsables de cargar las relaciones de manera eficiente.

No cargue colecciones y luego ejecute una consulta a la base de datos por cada registro para obtener datos relacionados.

Evite patrones equivalentes a:

```text
cargar usuarios
   ↓
para cada usuario
   ↓
cargar las relaciones del usuario
```

Prefiera consultas de relaciones que permitan a Prisma resolver los datos requeridos como parte de la operación del
repositorio.

Utilice `select` o `include` deliberadamente y solicite únicamente las relaciones requeridas por la operación de
aplicación.

Cuando se admita y sea adecuado, prefiera estrategias de carga de relaciones que eviten viajes de ida y vuelta
innecesarios a la base de datos.

El comportamiento de las consultas debe verificarse al trabajar con colecciones grandes o relaciones anidadas, en lugar
de asumir que la abstracción de ORM garantiza una ejecución óptima.

## Alcance de consultas

Los repositorios deben recuperar únicamente los datos requeridos por quien los llama.

Prefiera proyecciones explícitas cuando una operación requiera un subconjunto de un modelo.

Evite cargar grafos relacionales completos de forma predeterminada.

La carga de relaciones debe ser intencional y pertenecer a la operación del repositorio responsable de la consulta.

## Consultas sin procesar

Utilice de forma predeterminada la API de consultas normal de Prisma.

El SQL sin procesar debe reservarse para casos en los que el comportamiento requerido de la base de datos no pueda
expresarse con claridad o eficiencia mediante la API habitual de Prisma.

Las consultas sin procesar deben permanecer dentro del límite de persistencia y deben usar API parametrizadas.

Los servicios de aplicación no deben contener SQL sin procesar.

## Contratos de persistencia

Las estructuras de persistencia no deben usarse directamente como contratos de entrada HTTP o de aplicación.

Por ejemplo, un tipo de usuario generado por Prisma no debe convertirse en el contrato de solicitud para crear un
usuario.

Las responsabilidades de aplicación y persistencia pueden compartir campos y, a la vez, seguir siendo contratos
separados.

Esto evita que los campos específicos de persistencia se conviertan involuntariamente en parte de la API pública de la
aplicación.

## Reglas

1. Utilice PostgreSQL como base de datos relacional predeterminada.
2. Utilice Prisma como ORM predeterminado.
3. Acceda a la persistencia mediante repositorios propiedad de funcionalidades.
4. Mantenga la lógica específica de Prisma dentro del límite de persistencia.
5. No inyecte Prisma Client directamente en los servicios de aplicación.
6. Mantenga los repositorios privados para su funcionalidad de forma predeterminada.
7. Versione los cambios de la base de datos con Prisma Migrate.
8. Utilice transacciones compartidas para operaciones que requieren persistencia atómica de varios pasos.
9. Prevenga las consultas N+1 diseñando la carga de relaciones en el nivel de repositorio.
10. Cargue únicamente los campos y relaciones requeridos por una operación.
11. Mantenga el SQL sin procesar dentro de los repositorios y utilice API parametrizadas.
12. Mantenga los modelos de persistencia separados de los contratos de aplicación y transporte.
