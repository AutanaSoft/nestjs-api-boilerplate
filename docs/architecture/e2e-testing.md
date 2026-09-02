# Pruebas E2E

Este documento define la arquitectura de pruebas de extremo a extremo para el Boilerplate de API de NestJS.

Las pruebas E2E verifican la aplicación entregada a través de su límite HTTP público mediante un comportamiento de
tiempo de ejecución similar al de producción e infraestructura real aislada.

## Límite de la aplicación

Las pruebas E2E deben comenzar desde la misma raíz de aplicación y el comportamiento de arranque compartido que utiliza
producción.

El comportamiento de solicitudes públicas que afecta los contratos de tiempo de ejecución debe mantenerse equivalente,
incluidos los elementos aplicables:

- configuración del adaptador HTTP;
- pipes globales;
- filtros;
- interceptores;
- serialización;
- autenticación;
- configuración de la aplicación.

La configuración específica de E2E puede aislar infraestructura o proveedores externos, pero no debe reemplazar el flujo
interno de la aplicación que se está probando.

## Propiedad del ciclo de vida

Un entorno E2E compartido debe tener un único propietario explícito del ciclo de vida.

El propietario del ciclo de vida es responsable de:

- creación de la aplicación;
- configuración del entorno de pruebas;
- creación de bases de datos temporales;
- migraciones;
- registro de suites de funcionalidades;
- desmontaje de la aplicación;
- desmontaje de la base de datos;
- restauración del entorno.

El ejecutor de pruebas debe descubrir únicamente archivos del propietario del ciclo de vida.

Los orquestadores y las suites de funcionalidades importados no deben descubrirse ni ejecutarse también de forma
independiente.

## Estructura

Una suite E2E en crecimiento puede usar:

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

El descubrimiento de Vitest debe configurarse para que los orquestadores y las suites importados no se ejecuten de forma
independiente.

## Independencia de las pruebas

Los escenarios de endpoints independientes deben establecer sus propios requisitos previos y permanecer seguros al
reordenarse.

Las pruebas no deben depender silenciosamente del estado producido por una prueba anterior.

Un flujo de negocio ordenado puede compartir intencionalmente el estado cuando la secuencia en sí sea el comportamiento
que se está probando.

El estado de flujo compartido debe ser explícito y ser propiedad de un contexto de funcionalidad tipado, en lugar de
variables globales mutables.

## Infraestructura real

Las pruebas E2E deben utilizar persistencia real.

Para este proyecto, el entorno E2E debe usar una base de datos PostgreSQL aislada y la ruta de persistencia de Prisma de
producción.

El entorno debe:

1. crear una base de datos aislada;
2. aplicar las migraciones de Prisma confirmadas en el repositorio;
3. configurar la aplicación para usar esa base de datos;
4. iniciar la aplicación;
5. ejecutar los escenarios;
6. cerrar los recursos de aplicación y persistencia;
7. eliminar la base de datos temporal.

La ejecución de E2E debe fallar de forma segura cuando no pueda demostrarse que la base de datos configurada es segura
para las pruebas.

Las bases de datos de desarrollo y producción nunca deben reutilizarse como bases de datos E2E.

## Componentes reales de la aplicación

Los siguientes componentes deben mantenerse reales en las pruebas E2E:

- controladores;
- guards;
- pipes;
- interceptores;
- servicios de aplicación;
- repositorios;
- Prisma;
- PostgreSQL;
- flujos de autenticación.

No reemplace repositorios ni servicios de aplicación por implementaciones en memoria y describa el escenario resultante
como cobertura E2E completa.

## Autenticación

Los escenarios E2E autenticados deben obtener credenciales mediante el flujo de autenticación público.

No use tokens de acceso codificados de forma rígida ni preemitidos cuando la aplicación misma sea responsable de
emitirlos.

Esto garantiza que la configuración de autenticación, la emisión de tokens, los guards y la validación de usuarios
participen en el tiempo de ejecución probado.

## Fixtures

Los fixtures son propietarios de datos de solicitud nuevos utilizados por los escenarios E2E.

Prefiera fábricas canónicas que generen cargas útiles válidas con identidades únicas.

Por ejemplo:

```text
createValidUserPayload()
createValidRegistrationPayload()
```

Los fixtures no deben convertirse en estado mutable compartido.

Las cargas útiles inválidas deben derivarse de cargas útiles válidas nuevas modificando únicamente la propiedad
relevante para el escenario.

## Creación de datos

Cree datos de aplicación mediante endpoints HTTP públicos siempre que el comportamiento relevante esté disponible.

Por ejemplo, al probar la recuperación de usuarios, es preferible crear el usuario mediante la API pública en lugar de
insertarlo directamente mediante Prisma.

Esto garantiza que el requisito previo pase por las mismas reglas de validación y negocio que el uso normal de la
aplicación.

## Seeds

Los seeds de persistencia directa se permiten únicamente para condiciones previas explícitas que:

- no tienen una API pública de creación;
- serían innecesariamente costosas de crear mediante HTTP;
- requieren configuración de alto volumen;
- representan un estado persistido especial no disponible mediante API públicas.

Los seeds deben ser:

- mínimos;
- deterministas;
- aislados;
- reproducibles;
- realizados contra la capa real de persistencia E2E.

Un seed nunca debe omitir el comportamiento que el escenario afirma probar.

## Aserciones

Las aserciones E2E deben centrarse en el comportamiento observable públicamente.

Prefiera aserciones contra:

- estado HTTP;
- contratos de respuesta;
- encabezados;
- cookies;
- comportamiento de autorización;
- efectos persistidos observables;
- efectos externos observables;
- ausencia de campos prohibidos.

No compruebe llamadas internas de métodos de servicios, repositorios u ORM.

Cuando sea práctico, verifique los efectos de persistencia mediante una solicitud HTTP pública posterior, en lugar de
consultar directamente la base de datos.

## Salida confidencial

Las pruebas E2E deben verificar explícitamente que los campos confidenciales estén ausentes de respuestas donde no
correspondan.

Los ejemplos incluyen:

- contraseñas;
- hashes de contraseñas;
- secretos;
- metadatos de seguridad internos;
- valores de persistencia de tokens de actualización.

## Servicios externos

Mantenga real el comportamiento interno de la aplicación.

Las dependencias externas fuera de proceso pueden aislarse cuando llamar al proveedor real sea inseguro, no
determinista, costoso o no esté disponible.

Los ejemplos incluyen:

- correo electrónico;
- pagos;
- SMS;
- webhooks.

Reemplace únicamente el adaptador que cruza el límite del proceso.

```text
Flujo de la aplicación
      ↓
Adaptador externo
      ↓
Reemplazo de prueba
```

No reemplace el servicio de aplicación que posee el caso de uso.

El reemplazo de prueba debe capturar el contrato saliente para que el escenario pueda verificar el efecto externo
esperado sin ejecutar el efecto secundario real.

## Desmontaje

El propietario del ciclo de vida debe liberar cada recurso creado por el entorno E2E.

Esto incluye los elementos aplicables:

- instancias de aplicaciones NestJS;
- clientes de Prisma;
- conexiones de bases de datos;
- bases de datos temporales;
- dobles de prueba de proveedores externos;
- estado de entorno modificado.

No dependa de la terminación forzada del proceso para ocultar recursos no liberados.

## Reglas

1. Verifique el comportamiento E2E mediante el límite HTTP público.
2. Utilice comportamiento de arranque de aplicación derivado de producción.
3. Asigne a cada entorno E2E compartido un único propietario explícito del ciclo de vida.
4. Configure el descubrimiento de Vitest para impedir que las suites importadas se ejecuten de forma independiente.
5. Prefiera escenarios de endpoints independientes y reordenables.
6. Haga explícitos los flujos de negocio ordenados intencionales mediante contextos tipados.
7. Utilice persistencia PostgreSQL real aislada con migraciones de Prisma confirmadas en el repositorio.
8. Mantenga reales los controladores, servicios, repositorios, Prisma, autenticación y otros componentes internos de la
   aplicación.
9. Cree requisitos previos mediante HTTP siempre que exista el comportamiento público correspondiente.
10. Utilice seeds directos únicamente para condiciones previas documentadas y mínimas.
11. Aserte contratos públicos y efectos observables, en lugar de llamadas internas.
12. Aserte explícitamente que los campos confidenciales estén ausentes de respuestas no relacionadas.
13. Reemplace únicamente adaptadores externos fuera de proceso justificados.
14. Libere por completo los recursos de aplicación, base de datos y entorno de pruebas después de la ejecución.
