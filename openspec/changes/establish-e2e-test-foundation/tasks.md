# Tareas: establecer la base de pruebas E2E

Este plan implementa únicamente la organización y el soporte mínimo de la base E2E especificada para
`establish-e2e-test-foundation`. Las pruebas deben conservar el límite HTTP real de NestJS y no
deben anticipar capacidades de persistencia, autenticación o proveedores externos.

## Review Workload Forecast

| Field                   | Value                                               |
| ----------------------- | --------------------------------------------------- |
| Estimated changed lines | 450–550 líneas escritas (adiciones + eliminaciones) |
| 400-line budget risk    | High                                                |
| Chained PRs recommended | Yes                                                 |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4                           |
| Delivery strategy       | ask-on-risk                                         |
| Chain strategy          | feature-branch-chain                                |

Decision needed before apply: No Chained PRs recommended: Yes Chain strategy: feature-branch-chain
400-line budget risk: High

La estimación considera cuatro archivos TypeScript nuevos de soporte y sus pruebas, el nuevo
propietario, el traslado de los cuatro escenarios, la eliminación de `test/app.e2e-spec.ts`, la
configuración, y la actualización documental. La persona confirmó dividir la implementación en
entregas encadenadas mediante `feature-branch-chain`; no se acepta `size:exception`.

## Alcance y límites de implementación

- El único punto de entrada E2E descubierto será `test/main.e2e-spec.ts` mediante
  `vitest.config.e2e.ts`.
- `vitest.config.ts` no se modifica. La separación entre el descubrimiento unitario y el
  descubrimiento E2E queda diferida a otro cambio, aunque `pnpm test` pueda seguir coincidiendo con
  `*.e2e-spec.ts`.
- No se agregan PostgreSQL, Prisma, migrations, autenticación, fixtures, seeds, adaptadores
  externos, dobles de prueba de capacidades inexistentes, dependencias, interfaces vacías ni un
  módulo Nest exclusivo para pruebas.
- No se modifican `src/main.ts`, `src/app.module.ts`, `src/app.setup.ts`, `package.json`, los
  contratos HTTP públicos ni el comportamiento de CORS, Helmet o throttling.
- Las suites importadas usan el sufijo `*.e2e-suite.ts`, no poseen hooks de ciclo de vida y reciben
  únicamente `runScenario` mediante los tipos del diseño.
- Cada escenario independiente crea y cierra una aplicación nueva. El único caso que comparte estado
  entre solicitudes es la tercera solicitud del escenario de limitación de tasa.
- La implementación debe conservar `AppModule`, `httpConfig.KEY`, `ConfigType<typeof httpConfig>`,
  `setupApplication`, `app.init()` y `app.getHttpServer()` como parte del ensamblado E2E.
- El error de trabajo siempre precede a los errores de limpieza en `AggregateError`, y no se usa
  terminación forzada del proceso.

## Orden de unidades y dependencias

| Unidad | Entrega                                                           | Dependencia                   | Superficies principales                                                                                                |
| ------ | ----------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1      | Contratos tipados y creación de aplicación derivada de producción | Estado actual del repositorio | `test/support/e2e-context.ts`, `test/support/create-e2e-application.ts`, `test/support/create-e2e-application.spec.ts` |
| 2      | Entorno acotado, restauración y ejecución por escenario           | Unidad 1                      | `test/support/e2e-environment.ts`, `test/support/e2e-environment.spec.ts`                                              |
| 3      | Propietario único, registro y traslado de la línea base HTTP      | Unidades 1 y 2                | `vitest.config.e2e.ts`, `test/main.e2e-spec.ts`, `test/modules/app/app.e2e-suite.ts`, `test/app.e2e-spec.ts`           |
| 4      | Alineación documental y metadatos de OpenSpec                     | Unidad 3                      | `docs/testing/e2e-testing.md`, `openspec/config.yaml`, `openspec/changes/establish-e2e-test-foundation/tasks.md`       |

Cada unidad es un límite de rollback independiente. Las pruebas permanecen junto al soporte o
comportamiento que verifican. Las unidades 1 y 2 todavía no tienen una ejecución E2E completa hasta
la unidad 3; su arnés de ejecución se documenta como `N/A` por esa razón, y su evidencia debe
provenir de las pruebas enfocadas y de la compilación.

## Unidad 1 — Contratos tipados y aplicación E2E

**Inicio:** existe `test/app.e2e-spec.ts`, que crea la aplicación directamente, y no existe soporte
compartido bajo `test/support/`.

**Fin:** `createE2EApplication()` devuelve un `E2EContext` únicamente después de crear e inicializar
una aplicación basada en `AppModule`; los fallos de bootstrap intentan limpiar los recursos
parciales sin ocultar el error original.

**Rollback:** eliminar `test/support/e2e-context.ts`, `test/support/create-e2e-application.ts` y
`test/support/create-e2e-application.spec.ts`. No revertir ni alterar el bootstrap de producción.

### RED

- [ ] RED — Crear primero `test/support/create-e2e-application.spec.ts` con pruebas para el contexto
      devuelto, el ensamblado mediante `AppModule`, la lectura de `httpConfig.KEY`, la llamada a
      `setupApplication`, la inicialización completa, el cierre ante fallo de `setupApplication` o
      `app.init()`, y la precedencia del error original en `AggregateError`.
      <!-- sdd-owner: implementation -->

**Evidencia RED:** ejecutar el objetivo enfocado antes de crear el helper y conservar la salida que
demuestre que falta `createE2EApplication` o que los comportamientos objetivo aún no están
implementados.

```bash
pnpm exec vitest run test/support/create-e2e-application.spec.ts --config ./vitest.config.ts
```

Para provocar fallos de bootstrap se permite un punto de prueba local o un doble de módulo acotado a
la prueba; no se debe exportar una interface de producción ni sustituir componentes internos de
`AppModule`.

### GREEN

- [ ] GREEN — Crear `test/support/e2e-context.ts` y `test/support/create-e2e-application.ts` con
      `E2EContext`, `E2EScenario`, `RunE2EScenario`, `E2ESuiteRegistration` y
      `createE2EApplication()` conforme a `design.md`, usando `import type` para los tipos y sin
      `any`. <!-- sdd-owner: implementation -->

La implementación de `createE2EApplication()` debe seguir este orden: compilar un `TestingModule`
que importe `AppModule`, crear la aplicación Nest con el adaptador Express existente, obtener la
configuración tipada mediante `app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY)`, ejecutar
`setupApplication(app, config)` y llamar a `await app.init()`. No debe llamar a `listen` ni
reproducir manualmente Helmet, CORS, trust proxy o throttling.

Si `setupApplication` o `app.init()` falla después de crear una aplicación, se debe intentar
`app.close()` y propagar el error original. Si el cierre también falla, se conservan ambos en
`AggregateError` con el error original como primer elemento. Un fallo de compilación previo a un
recurso cerrable se propaga sin limpieza simulada.

**Evidencia GREEN:** el comando RED pasa y los casos verifican una aplicación usable solo después de
la inicialización completa.

### TRIANGULATE

- [ ] TRIANGULATE — Verificar `test/support/create-e2e-application.ts`,
      `test/support/create-e2e-application.spec.ts`, `src/app.module.ts` y `src/app.setup.ts` contra
      el ensamblado real, confirmando que no se modificaron los componentes de producción.
      <!-- sdd-owner: implementation -->

Ejecutar también `pnpm test` para comprobar que la prueba enfocada se integra con el ejecutor
unitario existente y `pnpm build` para comprobar los contratos TypeScript. La verificación E2E
completa queda para la unidad 3; en esta unidad el arnés de ejecución es `N/A` porque aún no existe
`test/main.e2e-spec.ts`.

### REFACTOR

- [ ] REFACTOR — Refinar `test/support/e2e-context.ts`, `test/support/create-e2e-application.ts` y
      `test/support/create-e2e-application.spec.ts` para mantener una superficie mínima,
      importaciones de tipos explícitas, manejo de `unknown` en errores y limpieza determinista sin
      duplicar el bootstrap de producción. <!-- sdd-owner: implementation -->

El refactor no debe introducir un creador público adicional, una abstracción genérica ni un
adaptador de prueba. La verificación focal posterior debe repetir el comando RED; la evidencia de
formato se completará con `pnpm exec prettier --check` durante la unidad 4.

## Unidad 2 — Entorno acotado y aislamiento por escenario

**Inicio:** la unidad 1 entrega `createE2EApplication()` y los contratos de contexto; el entorno
sigue mutándose y restaurándose directamente en `test/app.e2e-spec.ts`.

**Fin:** `createE2EEnvironment()` captura únicamente las tres claves permitidas, aplica los valores
E2E, ofrece `runScenario` y `dispose`, restaura presencia y valor exactos, y cierra cada aplicación
creada por escenario incluso ante fallos.

**Rollback:** eliminar `test/support/e2e-environment.ts` y `test/support/e2e-environment.spec.ts`;
conservar la organización anterior hasta que la unidad 3 haga el traslado atómico.

### RED

- [ ] RED — Crear primero `test/support/e2e-environment.spec.ts` con casos para valores presentes y
      ausentes de `CORS_ORIGINS`, `THROTTLE_LIMIT` y `THROTTLE_TTL_SECONDS`, preservación de claves
      ajenas, restauración normal, restauración tras preparación parcial, `dispose` idempotente,
      aplicación nueva por cada `runScenario`, cierre en éxito y fallo, y `AggregateError` con
      precedencia del error primario. <!-- sdd-owner: implementation -->

**Evidencia RED:** ejecutar la prueba antes del auxiliar y conservar la salida de fallos. Los casos
que toquen `process.env` deben ejecutarse de forma serial y restaurar su propio estado en `finally`;
no se permite usar APIs concurrentes para compartir ese estado.

```bash
pnpm exec vitest run test/support/e2e-environment.spec.ts --config ./vitest.config.ts
```

La simulación de fallos de `createE2EApplication()` puede resolverse con un doble local del módulo o
un punto de prueba privado estrictamente necesario para la prueba. No se debe crear
`DatabaseHarness`, un registro de mocks ni interfaces para capacidades futuras.

### GREEN

- [ ] GREEN — Crear `test/support/e2e-environment.ts` con `E2EEnvironment` y
      `createE2EEnvironment()`, limitando la lista a `CORS_ORIGINS`, `THROTTLE_LIMIT` y
      `THROTTLE_TTL_SECONDS` y conectando `runScenario` con `createE2EApplication()`.
      <!-- sdd-owner: implementation -->

La lista debe ser la tupla constante exacta
`['CORS_ORIGINS', 'THROTTLE_LIMIT', 'THROTTLE_TTL_SECONDS'] as const`. Antes de cualquier escritura
se captura `{ existed, value }` por clave usando presencia propia, no la verdad del valor. Se
aplican exactamente `https://allowed.example`, `2` y `60`.

`runScenario` crea un contexto nuevo para cada invocación, ejecuta el callback y cierra
`context.app` en `finally`. Si el callback y el cierre fallan, conserva ambos en `AggregateError`
con el fallo del callback primero. `createE2EEnvironment()` restaura una preparación parcial y
`dispose()` restaura una sola vez: reasigna valores de claves existentes, usa `delete` para claves
ausentes y no enumera ni altera otras claves.

**Evidencia GREEN:** el comando RED pasa y demuestra aislamiento de aplicación, restauración exacta,
idempotencia y limpieza sin terminación forzada.

### TRIANGULATE

- [ ] TRIANGULATE — Contrastar `test/support/e2e-environment.ts`,
      `test/support/e2e-environment.spec.ts` y `test/support/e2e-context.ts` para demostrar que el
      entorno no es un editor genérico de `process.env` ni incorpora persistencia, autenticación,
      fixtures, seeds o adaptadores externos. <!-- sdd-owner: implementation -->

Ejecutar la prueba enfocada, `pnpm test` y `pnpm build`. El arnés de ejecución E2E es `N/A` antes de
la unidad 3 porque aún no hay un propietario descubierto que registre `runScenario`.

La inspección debe confirmar que un fallo de escritura, preparación o bootstrap intenta restaurar lo
capturado, que un fallo de restauración no reemplaza el error original y que una llamada defensiva
repetida a `dispose()` no produce una segunda restauración.

### REFACTOR

- [ ] REFACTOR — Refinar `test/support/e2e-environment.ts` y `test/support/e2e-environment.spec.ts`
      para conservar la tupla cerrada, tipos reutilizables, ausencia frente a valor definido, manejo
      de `unknown` y una sola responsabilidad por helper. <!-- sdd-owner: implementation -->

No se debe extraer una abstracción para futuros recursos. Repetir el comando RED después del
refactor y mantener el rollback limitado a los dos archivos de esta unidad y sus contratos de
soporte de la unidad 1.

## Unidad 3 — Propietario único, registro y traslado de la línea base HTTP

**Inicio:** el repositorio conserva `test/app.e2e-spec.ts` como propietario descubierto y
`vitest.config.e2e.ts` usa `**/*.e2e-spec.ts`.

**Fin:** Vitest descubre solo `test/main.e2e-spec.ts`; ese archivo posee los hooks, registra
explícitamente `registerAppE2ESuite({ runScenario })`, y `test/modules/app/app.e2e-suite.ts` ejecuta
una sola vez los cuatro escenarios sin administrar el ciclo de vida.

**Rollback:** restaurar `include: ['**/*.e2e-spec.ts']`, restaurar `test/app.e2e-spec.ts` y retirar
`test/main.e2e-spec.ts`, `test/modules/app/app.e2e-suite.ts` y los cambios de conexión de esta
unidad. No revertir la corrección de Vitest en `openspec/config.yaml` durante el rollback documental
si Vitest continúa siendo el ejecutor real.

### RED

- [ ] RED — Usar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts`,
      `test/modules/app/app.e2e-suite.ts` y `test/app.e2e-spec.ts` para evidenciar primero que el
      patrón global permite propietarios accidentales o que falta el registro explícito; conservar
      la salida fallida de `pnpm run test:e2e` frente al contrato de punto de entrada único.
      <!-- sdd-owner: implementation -->

La fase RED puede establecer el `include` objetivo antes de completar el propietario, o construir
primero los casos que esperan `registerAppE2ESuite`; no debe dejarse como estado final una
configuración sin propietario registrado. La evidencia RED debe mostrar que la nueva organización
aún no satisface discovery, registro o ejecución única.

```bash
pnpm run test:e2e
```

### GREEN

- [ ] GREEN — Editar `vitest.config.e2e.ts` para usar exactamente
      `include: ['test/main.e2e-spec.ts']` y crear `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` con el registro explícito y los cuatro escenarios
      trasladados. <!-- sdd-owner: implementation -->

Se deben conservar plugins, SWC, aliases, `globals` y `root` de `vitest.config.e2e.ts`.
`test/main.e2e-spec.ts` es el único archivo con hooks globales: `beforeAll` crea `E2EEnvironment`,
`afterAll` llama a `dispose()` cuando la creación terminó y `runScenario` comprueba que el entorno
está inicializado antes de delegar. Las llamadas de registro deben ser directas y visibles, sin un
arreglo dinámico de registradores.

`test/modules/app/app.e2e-suite.ts` debe exportar
`registerAppE2ESuite(registration: E2ESuiteRegistration): void`, registrar `describe` e `it` sin
hooks y llamar a `registration.runScenario` en cada caso. Debe conservar sin relajar las aserciones
observables actuales: `GET /` con `200`, `Hello World!` y cabeceras de Helmet; CORS permitido y no
configurado; preflight `204`; y el límite `200`, `200`, `429` dentro de la aplicación del escenario.

Solo después de que el nuevo propietario pase, eliminar `test/app.e2e-spec.ts` para evitar
duplicación. El traslado no debe cambiar contratos HTTP, componentes internos ni el estado de
producción.

**Evidencia GREEN:** `pnpm run test:e2e` reporta un único archivo descubierto y cuatro escenarios
verdes, cada uno con una aplicación nueva y cierre determinista.

### TRIANGULATE

- [ ] TRIANGULATE — Verificar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts`,
      `test/modules/app/app.e2e-suite.ts` y `test/app.e2e-spec.ts` mediante la ejecución E2E y la
      inspección de la propiedad de hooks, registro y eliminación del propietario anterior.
      <!-- sdd-owner: implementation -->

Ejecutar los comandos siguientes y conservar sus resultados:

```bash
pnpm run test:e2e
pnpm test
pnpm build
```

La salida E2E debe identificar solo `test/main.e2e-spec.ts` y exactamente cuatro escenarios.
`pnpm test` puede incluir `test/main.e2e-spec.ts` por el glob amplio de `vitest.config.ts`; esa
coincidencia es una limitación explícitamente aceptada y no autoriza modificar `vitest.config.ts`.
La verificación debe comprobar que no hay `forceExit`, `listen`, hooks en `app.e2e-suite.ts`,
handles abiertos ni dependencia del orden entre `it` independientes.

### REFACTOR

- [ ] REFACTOR — Refinar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` para hacer legibles el orden de registro, la guarda de
      inicialización, el cierre condicional y el límite entre propietario y suite, sin crear
      propietarios adicionales. <!-- sdd-owner: implementation -->

Conservar importaciones de tipos con `import type`, no añadir APIs de ejecución innecesarias y
mantener las aserciones públicas junto a los cuatro casos. Repetir `pnpm run test:e2e` y `pnpm test`
tras el refactor. La unidad no debe modificar `vitest.config.ts`.

## Unidad 4 — Configuración y documentación de la convención

**Inicio:** `openspec/config.yaml` identifica Playwright para E2E y `docs/testing/e2e-testing.md` no
documenta todavía la convención concreta del nuevo propietario.

**Fin:** la configuración y la documentación describen la ejecución real con Vitest, el punto de
entrada único, el registro, el aislamiento y los límites futuros sin presentar infraestructura no
implementada como capacidad disponible.

**Rollback:** revertir únicamente la edición documental y los metadatos E2E de
`openspec/config.yaml`. La corrección a `Vitest` debe conservarse si sigue siendo el ejecutor real
del repositorio; no se revierte por una regresión de organización de pruebas.

### RED

- [ ] RED — Auditar `openspec/config.yaml`, `docs/testing/e2e-testing.md`, `vitest.config.e2e.ts` y
      `package.json` antes de editar, registrando como discrepancias verificables la referencia E2E
      a Playwright y la ausencia de instrucciones concretas para `test/main.e2e-spec.ts`,
      `*.e2e-suite.ts` y `pnpm run test:e2e`. <!-- sdd-owner: implementation -->

Esta auditoría es la evidencia RED de las superficies declarativas: no se debe crear una prueba
artificial para documentación ni modificar `package.json` para ocultar la discrepancia.

### GREEN

- [ ] GREEN — Editar `openspec/config.yaml` y `docs/testing/e2e-testing.md` para declarar `Vitest` y
      `pnpm run test:e2e`, describir el flujo implementado y separar explícitamente las extensiones
      futuras no implementadas. <!-- sdd-owner: implementation -->

En `openspec/config.yaml` se deben alinear el contexto, la capa E2E, el marco y el comando,
eliminando la identificación de Playwright para ese nivel sin cambiar `strict_tdd: true` ni los
comandos unitarios.

En `docs/testing/e2e-testing.md` se debe documentar, como mínimo:

- `test/main.e2e-spec.ts` como único archivo descubierto y propietario del ciclo de vida;
- `test/modules/<feature>/<feature>.e2e-suite.ts` como ubicación o nomenclatura no descubrible;
- el registro explícito y ordenado desde `test/main.e2e-spec.ts` mediante
  `registerAppE2ESuite({ runScenario })`;
- la creación y cierre de una aplicación por escenario independiente;
- `AppModule`, `httpConfig.KEY`, `ConfigType<typeof httpConfig>`, `setupApplication` y Supertest
  sobre `app.getHttpServer()`;
- la captura y restauración acotadas de `CORS_ORIGINS`, `THROTTLE_LIMIT` y `THROTTLE_TTL_SECONDS`;
- la conservación de los cuatro contratos HTTP actuales;
- las pautas futuras para PostgreSQL y Prisma con base aislada y migrations versionadas,
  autenticación mediante flujos HTTP públicos, aislamiento exclusivo del adaptador DI que cruza el
  límite externo y creación preferente de datos mediante HTTP;
- la reserva de seeds directos para prerrequisitos mínimos y justificados; y
- la prohibición actual de interfaces vacías, adaptadores falsos, infraestructura simulada,
  fixtures, seeds, dependencias y abstracciones prematuras.

### TRIANGULATE

- [ ] TRIANGULATE — Contrastar `openspec/config.yaml`, `docs/testing/e2e-testing.md`,
      `vitest.config.e2e.ts`, `package.json`, `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` para demostrar alineación entre metadatos, ejecución,
      estructura y documentación. <!-- sdd-owner: implementation -->

Ejecutar la verificación focal documental y de regresión:

```bash
pnpm exec prettier --check openspec/changes/establish-e2e-test-foundation/tasks.md docs/testing/e2e-testing.md openspec/config.yaml
pnpm exec markdownlint-cli2 openspec/changes/establish-e2e-test-foundation/tasks.md docs/testing/e2e-testing.md
pnpm run lint
pnpm test
pnpm run test:e2e
pnpm build
```

La comprobación debe confirmar que no quedan referencias de Playwright para E2E, que
`pnpm run test:e2e` sigue alineado con `vitest.config.e2e.ts`, que la documentación no promete DB,
Prisma, autenticación, fixtures, seeds o adaptadores externos implementados, y que no se editó
`vitest.config.ts`.

### REFACTOR

- [ ] REFACTOR — Refinar `docs/testing/e2e-testing.md`, `openspec/config.yaml` y
      `openspec/changes/establish-e2e-test-foundation/tasks.md` con prosa concisa, enlaces y
      referencias consistentes, tablas legibles y formato compatible con el Prettier y
      `markdownlint-cli2` del repositorio. <!-- sdd-owner: implementation -->

La documentación debe mantener la distinción entre base entregada y extensiones futuras, evitar
duplicar las reglas generales de `docs/testing/testing.md` y explicar el rollback sin convertirlo en
una instrucción para revertir el ejecutor real.

## Evidencia de aceptación transversal

La implementación estará lista para revisión cuando exista evidencia de todos los puntos siguientes:

- `pnpm run test:e2e` descubre únicamente `test/main.e2e-spec.ts` y ejecuta una sola vez los cuatro
  escenarios HTTP existentes.
- Cada `it` independiente obtiene una aplicación nueva, el caso de throttling conserva sus tres
  solicitudes en una sola aplicación y ningún escenario consume estado de otro.
- El bootstrap usa `AppModule`, `httpConfig.KEY`, `setupApplication`, `app.init()` y Supertest sobre
  el servidor HTTP real, sin modificar `src/main.ts` ni `src/app.setup.ts`.
- La restauración distingue una clave ausente de una clave definida, limita las mutaciones a las
  tres claves permitidas y conserva el error original ante una limpieza fallida.
- No hay hooks en `*.e2e-suite.ts`, terminación forzada, propietarios duplicados ni dependencias
  nuevas.
- `openspec/config.yaml`, `package.json`, `vitest.config.e2e.ts` y `docs/testing/e2e-testing.md`
  identifican consistentemente Vitest y `pnpm run test:e2e`.
- `vitest.config.ts` permanece sin cambios; la separación entre unit y E2E discovery queda
  registrada como trabajo posterior, no como una corrección de esta entrega.
- `pnpm exec prettier --check` y `pnpm exec markdownlint-cli2` pasan para el artefacto y los
  documentos modificados.

## Estrategia de entrega y decisión pendiente

Las unidades están ordenadas para permitir una futura partición por límites de revisión: soporte
tipado, entorno, propietario con traslado, y documentación/configuración. La estimación actual es de
riesgo alto frente al presupuesto de 400 líneas. La persona decidió partir la implementación en
cuatro entregas mediante `feature-branch-chain`. Esta decisión define la planificación; no crea
ramas, commits ni PRs, y la implementación sigue requiriendo aprobación explícita.

## Verificación del artefacto de tareas

El artefacto debe formatearse con el Prettier del repositorio y validarse con `markdownlint-cli2`
usando el archivo `.markdownlint-cli2.jsonc`:

```bash
pnpm exec prettier --write openspec/changes/establish-e2e-test-foundation/tasks.md
pnpm exec markdownlint-cli2 openspec/changes/establish-e2e-test-foundation/tasks.md
```
