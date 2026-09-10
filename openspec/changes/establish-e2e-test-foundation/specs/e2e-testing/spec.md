# Especificación de la base E2E

## Propósito

La base E2E debe permitir ampliar las pruebas HTTP reales de la API NestJS con una propiedad clara
del ciclo de vida, aislamiento determinista por escenario y una convención explícita para registrar
suites. La capacidad debe conservar el bootstrap derivado de producción y las cuatro comprobaciones
HTTP públicas existentes, sin anticipar infraestructura para capacidades que todavía no forman parte
de la aplicación.

## Requirements

### Requirement: Propietario único del ciclo de vida descubierto por Vitest

El proyecto MUST configurar el descubrimiento E2E de Vitest para que `test/main.e2e-spec.ts` sea el
único punto de entrada descubierto y el único propietario del ciclo de vida del entorno E2E
compartido. Las suites importadas por ese punto de entrada MUST NOT coincidir con el patrón de
descubrimiento ni ejecutarse como puntos de entrada independientes. La propiedad única del ciclo de
vida MUST NOT implicar una única instancia global de la aplicación cuando el aislamiento por
escenario requiera instancias nuevas.

#### Scenario: Vitest descubre un único propietario

- GIVEN `vitest.config.e2e.ts` y una suite de funcionalidad importada que no es un punto de entrada
  descubierto.
- WHEN se ejecuta `pnpm run test:e2e`.
- THEN Vitest descubre `test/main.e2e-spec.ts` como único punto de entrada E2E y no ejecuta la suite
  importada por separado.

### Requirement: Registro explícito de suites no descubribles

El propietario principal MUST importar y registrar explícitamente las suites de funcionalidad en un
orden revisable. Las suites importadas MUST registrar sus escenarios, pero MUST NOT poseer ganchos
que creen o cierren aplicaciones, muten `process.env` o liberen recursos del entorno compartido. La
nomenclatura o ruta de cada suite importada MUST mantenerla fuera del patrón de descubrimiento de
Vitest.

#### Scenario: La suite de funcionalidad se ejecuta mediante registro

- GIVEN los cuatro escenarios HTTP actuales están organizados en una suite de funcionalidad
  importada con nomenclatura o ruta no descubrible.
- WHEN `test/main.e2e-spec.ts` registra esa suite en un orden explícito y se ejecuta
  `pnpm run test:e2e`.
- THEN los escenarios se ejecutan una sola vez a través del propietario principal, el orden de
  registro queda visible y la suite importada no crea aplicaciones ni administra recursos globales.

### Requirement: Aplicación nueva para cada escenario independiente

Cada escenario E2E independiente MUST recibir una aplicación NestJS nueva, inicializada para ese
escenario, y MUST cerrar de forma determinista los recursos que haya utilizado al finalizar. Los
escenarios independientes MUST permanecer seguros al reordenarse y MUST NOT depender del estado
producido por otro escenario. El desmontaje MUST NOT depender de la terminación forzada del proceso.

#### Scenario: El límite de tasa permanece aislado

- GIVEN los escenarios independientes de la línea base se ejecutan en cualquier orden.
- WHEN cada escenario inicia y finaliza su ciclo de aplicación.
- THEN cada escenario utiliza una aplicación NestJS nueva, el estado del limitador no se filtra
  entre escenarios y todos los recursos se cierran sin terminación forzada.

### Requirement: Bootstrap E2E derivado del bootstrap de producción

La aplicación creada para E2E MUST utilizar `AppModule`, obtener la configuración tipada `http` y
aplicar `setupApplication` antes de atender solicitudes HTTP. Los escenarios MUST ejercitar el
servidor HTTP real mediante Supertest y los componentes internos relevantes para el comportamiento
probado MUST permanecer reales. El bootstrap de producción y sus contratos públicos MUST permanecer
sin cambios por esta organización de pruebas.

#### Scenario: La aplicación E2E reproduce el ensamblado HTTP de producción

- GIVEN un escenario que envía una solicitud al servidor HTTP de la aplicación E2E.
- WHEN el propietario crea e inicializa la aplicación para ese escenario.
- THEN la aplicación se ensambla desde `AppModule`, utiliza la configuración `http`, aplica
  `setupApplication` y responde a través del servidor HTTP real sin sustituir componentes internos
  relevantes.

### Requirement: Configuración E2E acotada por Vitest

`vitest.config.e2e.ts` MUST definir `CORS_ORIGINS=https://allowed.example`, `THROTTLE_LIMIT=2` y
`THROTTLE_TTL_SECONDS=60` mediante `test.env`. El helper E2E MUST NOT leer, modificar ni restaurar
`process.env`; Vitest aplica los valores al contexto de prueba E2E.

#### Scenario: La configuración E2E prevalece sobre valores externos

- GIVEN que el proceso invocador proporciona valores conflictivos para las tres variables E2E.
- WHEN se ejecuta `pnpm run test:e2e`.
- THEN los contratos CORS y de límite de tasa se verifican con los valores definidos por
  `vitest.config.e2e.ts`, sin mutación ni restauración por el helper.

### Requirement: Conservación de los cuatro escenarios HTTP públicos actuales

La reorganización MUST conservar, sin cambiar su intención ni sus contratos observables, los cuatro
escenarios públicos existentes: respuesta de `GET /` con cabeceras de Helmet, comportamiento CORS
para un origen permitido y uno no configurado, solicitud preflight permitida y límite de tasa
configurado.

#### Scenario: La respuesta raíz y las cabeceras de Helmet se conservan

- GIVEN una aplicación E2E recién inicializada.
- WHEN se solicita `GET /` mediante Supertest.
- THEN la respuesta tiene estado `200`, texto `Hello World!`, `x-content-type-options` con valor
  `nosniff` y `x-frame-options` con valor `SAMEORIGIN`.

#### Scenario: CORS conserva los orígenes permitido y no configurado

- GIVEN `https://allowed.example` es el origen configurado y `https://denied.example` no está
  configurado.
- WHEN se solicita `GET /` con cada origen mediante la cabecera `Origin`.
- THEN el origen permitido recibe `access-control-allow-origin` con valor `https://allowed.example`,
  sin `access-control-allow-credentials`, y el origen no configurado no recibe
  `access-control-allow-origin`.

#### Scenario: El preflight permitido conserva su respuesta

- GIVEN una solicitud preflight desde `https://allowed.example` para el método `GET`.
- WHEN se envía `OPTIONS /` con `Origin` y `Access-Control-Request-Method`.
- THEN la respuesta tiene estado `204` y contiene `access-control-allow-origin` con valor
  `https://allowed.example`.

#### Scenario: El límite de tasa conserva su umbral

- GIVEN el límite E2E está configurado en dos solicitudes dentro del TTL.
- WHEN se envían tres solicitudes `GET /` desde la aplicación del escenario.
- THEN las dos primeras responden con estado `200` y la tercera responde con estado `429`.

### Requirement: Puntos de extensión futuros documentados sin abstracciones prematuras

`docs/testing/e2e-testing.md` MUST documentar como pautas futuras, y no como capacidades
implementadas por este cambio, la integración de PostgreSQL y Prisma con una base temporal aislada y
migraciones versionadas, la autenticación mediante los flujos HTTP públicos, el aislamiento
exclusivo del adaptador de DI que cruza un límite fuera de proceso y la creación preferente de datos
de prueba mediante HTTP, reservando los `seeds` directos para prerrequisitos mínimos y justificados.
La documentación MUST distinguir explícitamente estas extensiones futuras de la base E2E entregada.

#### Scenario: La documentación separa la base actual de sus extensiones

- GIVEN una persona incorpora una funcionalidad que todavía no existe en la aplicación.
- WHEN consulta `docs/testing/e2e-testing.md`.
- THEN encuentra las pautas futuras para persistencia, autenticación, proveedores externos y datos
  de prueba, junto con la indicación de que no se implementan interfaces vacías, adaptadores falsos,
  infraestructura simulada ni abstracciones anticipadas en esta base.

### Requirement: Corrección de los metadatos E2E de OpenSpec

`openspec/config.yaml` MUST identificar `Vitest` como framework del nivel E2E y `pnpm run test:e2e`
como su comando oficial. Los metadatos E2E MUST NOT identificar Playwright mientras Vitest sea el
ejecutor real del repositorio.

#### Scenario: Los metadatos coinciden con la ejecución E2E del repositorio

- GIVEN el paquete y `vitest.config.e2e.ts` definen Vitest como ejecutor E2E.
- WHEN se consulta la configuración E2E de OpenSpec.
- THEN `openspec/config.yaml` declara `Vitest` y `pnpm run test:e2e`, sin referencias de Playwright
  para ese nivel de pruebas.

### Requirement: Documentación de la convención concreta del proyecto

`docs/testing/e2e-testing.md` MUST describir la convención resultante de descubrimiento exclusivo,
nomenclatura o rutas no descubribles, registro explícito, propiedad del ciclo de vida, aplicación
nueva por escenario independiente, bootstrap mediante `AppModule` y `setupApplication`,
configuración E2E mediante `test.env`, aislamiento de las cuatro comprobaciones actuales y puntos de
extensión futuros. La actualización MUST mantener la alineación con `vitest.config.e2e.ts` y
`pnpm run test:e2e`.

#### Scenario: Una persona puede registrar una nueva suite sin crear otro propietario

- GIVEN una persona necesita añadir una suite de funcionalidad E2E.
- WHEN sigue las instrucciones de `docs/testing/e2e-testing.md`.
- THEN puede identificar dónde ubicar o nombrar la suite, cómo importarla y registrarla desde
  `test/main.e2e-spec.ts`, cómo aislar cada escenario independiente y qué capacidades futuras no
  debe implementar prematuramente.
