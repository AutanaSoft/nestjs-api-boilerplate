# Pruebas E2E

Este documento define la arquitectura de E2E Testing del proyecto.

Los E2E Tests verifican la aplicación entregada a través de su límite HTTP público mediante un comportamiento de runtime
similar al de producción e infraestructura real aislada.

## Límite de la aplicación

Los E2E Tests deben comenzar desde la misma application root y el mismo bootstrap compartido que utiliza producción.

El comportamiento de Requests públicos que afecta los runtime contracts debe mantenerse equivalente, incluidos los
elementos aplicables:

- configuración del HTTP adapter;
- global Pipes;
- Filters;
- Interceptors;
- serialization;
- authentication;
- configuración de la aplicación.

La configuración específica de E2E puede aislar infraestructura o external Providers, pero no debe reemplazar el flujo
interno de la aplicación que se está probando.

## Lifecycle Ownership

Un entorno E2E compartido debe tener un único lifecycle owner explícito.

El lifecycle owner es responsable de:

- creación de la aplicación;
- configuración del test environment;
- creación de temporary databases;
- migrations;
- registro de Feature suites;
- application teardown;
- database teardown;
- restauración del entorno.

El Test Runner debe descubrir únicamente los archivos del lifecycle owner.

Los Feature orchestrators y suites importados no deben descubrirse ni ejecutarse también de forma independiente.

## Estructura

Una E2E suite en crecimiento puede usar:

```text
test/
├── main.e2e-spec.ts
├── support/
├── fixtures/
└── modules/
```

Por ejemplo:

```text
test/
├── main.e2e-spec.ts
├── support/
│   ├── e2e-environment.ts
│   ├── e2e-application.ts
│   └── external-boundary-overrides.ts
├── fixtures/
│   ├── auth.fixture.ts
│   └── users.fixture.ts
└── modules/
    ├── auth/
    │   ├── auth.e2e-orchestrator.ts
    │   └── suites/
    └── users/
        ├── users.e2e-orchestrator.ts
        └── suites/
```

Los directorios deben introducirse a medida que la suite crece, en lugar de como boilerplate vacío obligatorio.

Vitest discovery debe configurarse para que los imported orchestrators y suites no se ejecuten de forma independiente.

## Independencia de las pruebas

Los escenarios de Endpoints independientes deben establecer sus propios prerequisites y permanecer seguros al reordenarse.

Las pruebas no deben depender silenciosamente del estado producido por una prueba anterior.

Un ordered business flow puede compartir intencionalmente el estado cuando la secuencia en sí sea el comportamiento que
se está probando.

El shared flow state debe ser explícito y pertenecer a un typed Feature context, en lugar de variables globales mutables.

## Infraestructura real

Los E2E Tests deben utilizar persistencia real.

Para este proyecto, el entorno E2E debe usar una base de datos PostgreSQL aislada y el production Prisma persistence path.

El entorno debe:

1. crear una base de datos aislada;
2. aplicar las Prisma migrations versionadas en el repositorio;
3. configurar la aplicación para usar esa base de datos;
4. iniciar la aplicación;
5. ejecutar los escenarios;
6. cerrar los recursos de aplicación y persistencia;
7. eliminar la base de datos temporal.

La ejecución E2E debe detenerse de forma segura cuando no pueda demostrarse que la base de datos configurada es segura
para testing.

Las bases de datos de desarrollo y producción nunca deben reutilizarse como E2E databases.

## Componentes reales de la aplicación

Los siguientes componentes deben mantenerse reales en los E2E Tests:

- Controllers;
- Guards;
- Pipes;
- Interceptors;
- Application Services;
- Repositories;
- Prisma;
- PostgreSQL;
- authentication flows.

No reemplace Repositories ni Application Services por in-memory implementations y describa el escenario resultante como
cobertura E2E completa.

## Autenticación

Los escenarios E2E autenticados deben obtener credentials mediante el public authentication flow.

No use hardcoded o pre-issued Access Tokens cuando la aplicación misma sea responsable de emitirlos.

Esto garantiza que la configuración de autenticación, token issuance, Guards y user validation participen en el runtime
probado.

## Fixtures

Los Fixtures son responsables de fresh Request data utilizados por los escenarios E2E.

Prefiera canonical factories que generen valid payloads con identidades únicas.

Por ejemplo:

```text
createValidUserPayload()
createValidRegistrationPayload()
```

Los Fixtures no deben convertirse en shared mutable state.

Los invalid payloads deben derivarse de fresh valid payloads modificando únicamente la propiedad relevante para el
escenario.

## Creación de datos

Cree application data mediante public HTTP Endpoints siempre que el comportamiento relevante esté disponible.

Por ejemplo, al probar la recuperación de usuarios, es preferible crear el usuario mediante la API pública en lugar de
insertarlo directamente mediante Prisma.

Esto garantiza que el prerequisite pase por las mismas validation rules y business rules que el uso normal de la
aplicación.

## Seeds

Los direct persistence Seeds se permiten únicamente para preconditions explícitas que:

- no tienen una public creation API;
- serían innecesariamente costosas de crear mediante HTTP;
- requieren high-volume setup;
- representan un estado persistido especial no disponible mediante APIs públicas.

Los Seeds deben ser:

- mínimos;
- deterministas;
- aislados;
- reproducibles;
- realizados contra la capa real de persistencia E2E.

Un Seed nunca debe omitir el comportamiento que el escenario afirma probar.

## Assertions

Las E2E Assertions deben centrarse en el comportamiento observable públicamente.

Prefiera Assertions contra:

- HTTP status;
- Response contracts;
- headers;
- cookies;
- authorization behavior;
- observable persisted effects;
- observable external effects;
- ausencia de forbidden fields.

No verifique llamadas internas a métodos de Services, Repositories u ORM.

Cuando sea práctico, verifique los persistence effects mediante un Request HTTP público posterior, en lugar de consultar
directamente la base de datos.

## Sensitive Output

Los E2E Tests deben verificar explícitamente que los sensitive fields estén ausentes de Responses donde no correspondan.

Los ejemplos incluyen:

- passwords;
- password hashes;
- secrets;
- internal security metadata;
- Refresh Token persistence values.

## Servicios externos

Mantenga real el comportamiento interno de la aplicación.

Las external out-of-process dependencies pueden aislarse cuando llamar al Provider real sea inseguro, no determinista,
costoso o no esté disponible.

Los ejemplos incluyen:

- email;
- payments;
- SMS;
- webhooks.

Reemplace únicamente el adapter que cruza el process boundary.

```text
Application flow
      ↓
External adapter
      ↓
Test replacement
```

No reemplace el Application Service responsable del caso de uso.

El Test Replacement debe capturar el outgoing contract para que el escenario pueda verificar el external effect esperado
sin ejecutar el side effect real.

## Teardown

El lifecycle owner debe liberar cada recurso creado por el entorno E2E.

Esto incluye los elementos aplicables:

- instancias de aplicaciones NestJS;
- Prisma clients;
- database connections;
- temporary databases;
- Test Doubles de external Providers;
- environment state modificado.

No dependa de forced process termination para ocultar leaked resources.

## Reglas

1. Verifique el comportamiento E2E mediante el límite HTTP público.
2. Utilice application bootstrap behavior derivado de producción.
3. Asigne a cada entorno E2E compartido un único lifecycle owner explícito.
4. Configure Vitest discovery para impedir que las imported suites se ejecuten de forma independiente.
5. Prefiera escenarios de Endpoints independientes y reordenables.
6. Haga explícitos los ordered business flows mediante typed contexts.
7. Utilice persistencia PostgreSQL real aislada con Prisma migrations versionadas en el repositorio.
8. Mantenga reales los Controllers, Services, Repositories, Prisma, authentication y otros componentes internos de la
   aplicación.
9. Cree prerequisites mediante HTTP siempre que exista el comportamiento público correspondiente.
10. Utilice direct Seeds únicamente para preconditions documentadas y mínimas.
11. Verifique public contracts y observable effects, en lugar de internal calls.
12. Verifique explícitamente que los sensitive fields estén ausentes de Responses no relacionadas.
13. Reemplace únicamente external out-of-process adapters cuando esté justificado.
14. Libere por completo los recursos de aplicación, base de datos y test environment después de la ejecución.
