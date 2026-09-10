# Apply progress: establish-e2e-test-foundation

## Unit 1 — e2e application

**Status:** complete. Only Unit 1 was applied on `feature/e2e-foundation-01-app`; Units 2–4 were not
started.

### Completed tasks

- [x] RED — Crear primero `test/support/create-e2e-application.spec.ts` con pruebas para el contexto
      devuelto, el ensamblado mediante `AppModule`, la lectura de `httpConfig.KEY`, la llamada a
      `setupApplication`, la inicialización completa, el cierre ante fallo de `setupApplication` o
      `app.init()`, y la precedencia del error original en `AggregateError`.
- [x] GREEN — Crear `test/support/e2e-context.ts` y `test/support/create-e2e-application.ts` con
      `E2EContext`, `E2EScenario`, `RunE2EScenario`, `E2ESuiteRegistration` y
      `createE2EApplication()` conforme a `design.md`, usando `import type` para los tipos y sin
      `any`.
- [x] TRIANGULATE — Verificar `test/support/create-e2e-application.ts`,
      `test/support/create-e2e-application.spec.ts`, `src/app.module.ts` y `src/app.setup.ts` contra
      el ensamblado real, confirmando que no se modificaron los componentes de producción.
- [x] REFACTOR — Refinar `test/support/e2e-context.ts`, `test/support/create-e2e-application.ts` y
      `test/support/create-e2e-application.spec.ts` para mantener una superficie mínima,
      importaciones de tipos explícitas, manejo de `unknown` en errores y limpieza determinista sin
      duplicar el bootstrap de producción.

The same four Unit 1 checkboxes are visibly marked `[x]` in `tasks.md`.

### Files changed

- `test/support/e2e-context.ts`
- `test/support/create-e2e-application.ts`
- `test/support/create-e2e-application.spec.ts`
- `openspec/changes/establish-e2e-test-foundation/tasks.md`
- `openspec/changes/establish-e2e-test-foundation/apply-progress.md`

### TDD Cycle Evidence

| Task   | Test file                                     | Layer                                          | Safety net      | RED                                                                                                                                           | GREEN                          | TRIANGULATE                                                                             | REFACTOR                                   |
| ------ | --------------------------------------------- | ---------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| Unit 1 | `test/support/create-e2e-application.spec.ts` | Nest integration with scoped bootstrap doubles | N/A (new files) | `pnpm exec vitest run test/support/create-e2e-application.spec.ts --config ./vitest.config.ts` failed because the helper module did not exist | Same focused command: 3 passed | Added compilation-before-resource and typed-config-key paths; focused command: 4 passed | Ran Prettier and focused command: 4 passed |

### Verification

- `pnpm exec vitest run test/support/create-e2e-application.spec.ts --config ./vitest.config.ts`:
  passed, 4 tests.
- `pnpm test`: passed, 25 tests in 4 files.
- `pnpm build`: passed, TypeScript found 0 issues and SWC compiled 6 files.
- `pnpm run lint`: passed.
- `pnpm exec prettier --write test/support/e2e-context.ts test/support/create-e2e-application.ts test/support/create-e2e-application.spec.ts`:
  completed; files unchanged after formatting.

The full E2E harness is N/A for this unit because `test/main.e2e-spec.ts` is a Unit 3 deliverable.

### Design conformance and deviations

`createE2EApplication()` compiles `AppModule`, creates the Nest application, gets
`ConfigType<typeof httpConfig>` through `httpConfig.KEY`, calls `setupApplication`, then initializes
the app. It neither listens nor recreates HTTP middleware. Bootstrap cleanup closes a partial app
and uses `AggregateError` with the original failure first when cleanup also fails. No production
files were modified. No deviations.

### Remaining implementation tasks

- [ ] RED — Crear primero `test/support/e2e-environment.spec.ts` con casos para valores presentes y
      ausentes de `CORS_ORIGINS`, `THROTTLE_LIMIT` y `THROTTLE_TTL_SECONDS`, preservación de claves
      ajenas, restauración normal, restauración tras preparación parcial, `dispose` idempotente,
      aplicación nueva por cada `runScenario`, cierre en éxito y fallo, y `AggregateError` con
      precedencia del error primario.
- [ ] GREEN — Crear `test/support/e2e-environment.ts` con `E2EEnvironment` y
      `createE2EEnvironment()`, limitando la lista a `CORS_ORIGINS`, `THROTTLE_LIMIT` y
      `THROTTLE_TTL_SECONDS` y conectando `runScenario` con `createE2EApplication()`.
- [ ] TRIANGULATE — Contrastar `test/support/e2e-environment.ts`,
      `test/support/e2e-environment.spec.ts` y `test/support/e2e-context.ts` para demostrar que el
      entorno no es un editor genérico de `process.env` ni incorpora persistencia, autenticación,
      fixtures, seeds o adaptadores externos.
- [ ] REFACTOR — Refinar `test/support/e2e-environment.ts` y `test/support/e2e-environment.spec.ts`
      para conservar la tupla cerrada, tipos reutilizables, ausencia frente a valor definido, manejo
      de `unknown` y una sola responsabilidad por helper.
- [ ] RED — Usar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts`,
      `test/modules/app/app.e2e-suite.ts` y `test/app.e2e-spec.ts` para evidenciar primero que el
      patrón global permite propietarios accidentales o que falta el registro explícito; conservar
      la salida fallida de `pnpm run test:e2e` frente al contrato de punto de entrada único.
- [ ] GREEN — Editar `vitest.config.e2e.ts` para usar exactamente
      `include: ['test/main.e2e-spec.ts']` y crear `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` con el registro explícito y los cuatro escenarios
      trasladados.
- [ ] TRIANGULATE — Verificar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts`,
      `test/modules/app/app.e2e-suite.ts` y `test/app.e2e-spec.ts` mediante la ejecución E2E y la
      inspección de la propiedad de hooks, registro y eliminación del propietario anterior.
- [ ] REFACTOR — Refinar `vitest.config.e2e.ts`, `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` para hacer legibles el orden de registro, la guarda de
      inicialización, el cierre condicional y el límite entre propietario y suite, sin crear
      propietarios adicionales.
- [ ] RED — Auditar `openspec/config.yaml`, `docs/testing/e2e-testing.md`, `vitest.config.e2e.ts` y
      `package.json` antes de editar, registrando como discrepancias verificables la referencia E2E
      a Playwright y la ausencia de instrucciones concretas para `test/main.e2e-spec.ts`,
      `*.e2e-suite.ts` y `pnpm run test:e2e`.
- [ ] GREEN — Editar `openspec/config.yaml` y `docs/testing/e2e-testing.md` para declarar `Vitest` y
      `pnpm run test:e2e`, describir el flujo implementado y separar explícitamente las extensiones
      futuras no implementadas.
- [ ] TRIANGULATE — Contrastar `openspec/config.yaml`, `docs/testing/e2e-testing.md`,
      `vitest.config.e2e.ts`, `package.json`, `test/main.e2e-spec.ts` y
      `test/modules/app/app.e2e-suite.ts` para demostrar alineación entre metadatos, ejecución,
      estructura y documentación.
- [ ] REFACTOR — Refinar `docs/testing/e2e-testing.md`, `openspec/config.yaml` y
      `openspec/changes/establish-e2e-test-foundation/tasks.md` con prosa concisa, enlaces y
      referencias consistentes, tablas legibles y formato compatible con el Prettier y
      `markdownlint-cli2` del repositorio.

### Workload and PR boundary

The resolved delivery path is `feature-branch-chain`. This change is Unit 1 only: typed context plus
production-derived application creator and its tests. Rollback boundary: remove the three
`test/support/` Unit 1 files; no production bootstrap changes require rollback. No commit, branch,
push, or PR was created.

### Consumed structured status

- `changeName`: `establish-e2e-test-foundation`
- `applyState`: `ready`
- `artifactStore`: `openspec`
- `actionContext.mode`: `repo-local`
- `allowedEditRoots`: repository root
- Warnings: none
