# Plan de implementación de Swagger/OpenAPI (OB-07)

Este plan completa **OB-07** sin crear DTOs de Swagger ni un segundo owner de contratos. La
especificación se generará desde los módulos públicos y los schemas Zod canónicos; la UI y el
documento se expondrán solo cuando se habiliten explícitamente.

## Resultado y decisiones aprobadas

| Tema                  | Decisión                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exposición            | Configurable y deshabilitada por defecto.                                                                                                           |
| Rutas públicas        | `GET /docs` y `GET /openapi.json` por defecto; quedan fuera de `API_GLOBAL_PREFIX` y del URI versioning.                                            |
| Metadata              | `title`, `description` y `version` provienen exclusivamente del namespace `app` ya existente.                                                       |
| Contratos             | Cada schema OpenAPI se convierte directamente desde el schema Zod canónico; no se crean Swagger DTOs, clases paralelas ni tipos equivalentes.       |
| Operaciones           | Cada handler público tiene un `operationId` explícito, estable y único.                                                                             |
| Alcance del documento | Incluye únicamente módulos/controladores de producción publicados; excluye el catch-all de rutas no encontradas y todo controller exclusivo de E2E. |

La implementación debe conservar el ownership definido por
[Contratos HTTP](../../api/http-contracts.md), [OpenAPI](../../api/openapi.md),
[validación](../../architecture/validation.md), [serialización](../../architecture/serialization.md)
y [configuración](../../architecture/configuration.md). OpenAPI representa el contrato: no pasa a
ser su fuente de verdad.

## Estado de partida verificado

- `AppModule` registra `HealthModule`, `ErrorHandlingModule`, serialización y validación; la única
  ruta productiva documentable actual es health. `NotFoundController` es un catch-all versionado del
  módulo transversal de errores y no es una operación pública documentable.
- `HealthController` declara `GET /health/live` y `GET /health/ready`, con versión URI `v1` y el
  `healthResponseSchema` canónico de Zod ya aplicado por `@SerializeOptions`.
- `ErrorResponse` existe hoy como tipo TypeScript en `src/common/error-handling/error-response.ts`.
  Antes de documentarlo, debe recibir un schema Zod canónico en ese owner y el tipo debe derivarse
  de él; no se documentará una forma escrita por separado en decoradores.
- El bootstrap común instala el prefijo global, URI versioning, correlación, Helmet y CORS en
  `setupApplication()`. Producción y E2E lo reutilizan.
- Los controllers de `test/support/` se agregan solo al módulo de pruebas; no están en `AppModule` y
  no deben entrar en el documento.
- `appConfig` ya valida y expone `name`, `description` y `version`. No se duplicarán mediante
  variables `OPENAPI_*` de metadata.

## Evidencia de dependencias y API

| Evidencia                                                                                                                  | Implicación para la implementación                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El proyecto fija NestJS 12 (`@nestjs/common` y `@nestjs/core` resueltos en `12.0.1`) y aún no declara `@nestjs/swagger`.   | Añadir `@nestjs/swagger@12.0.1`; su rango de peers publicado incluye NestJS 12. Confirmar el metadata/resolución efectivo de pnpm antes de modificar el lockfile.                                                                                                                                                                                                                                         |
| La versión instalada es `zod@4.5.4`. Sus declaraciones locales y la ejecución ESM confirman `z.toJSONSchema` como función. | Convertir directamente el schema owner con `z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'output' })` para Responses. Para Request bodies/parameters con transforms, usar `io: 'input'`. No usar un conversor externo ni DTOs.                                                                                                                                                                     |
| La firma local de Zod permite los targets `openapi-3.0`, `draft-07` y `draft-2020-12`, con `io` explícito.                 | Mantener el adaptador pequeño y probar su salida. Si una futura operación `QUERY` exige OpenAPI 3.2 conforme al owner, validar primero la compatibilidad efectiva entre el generador y el JSON Schema emitido; no falsificar una versión del documento.                                                                                                                                                   |
| El owner `openapi.md` exige `@nestjs/swagger`, errores compartidos y operation IDs estables.                               | Usar `DocumentBuilder`, `SwaggerModule.createDocument()` y los decoradores mínimos de operación/respuesta; los valores `schema` proceden del conversor Zod único.                                                                                                                                                                                                                                         |
| La API efectiva de `@nestjs/swagger@12.0.1` todavía debe verificarse contra el paquete resuelto.                           | Durante la fase de dependencias, verificar y registrar la opción exacta de `SwaggerModule.setup()` que fija exclusivamente JSON. La hipótesis inicial es `raw: ['json']` junto con `jsonDocumentUrl` explícito; no se codifica esa hipótesis hasta comprobarla. Debe exponer exactamente `/docs` y `/openapi.json` por defecto y suprimir YAML, la ruta JSON por defecto y rutas auxiliares de documento. |

Fuentes que la implementación debe conservar junto a la actualización de dependencias:

- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction), para `SwaggerModule` y
  `DocumentBuilder`.
- [npm: @nestjs/swagger 12.0.1](https://www.npmjs.com/package/@nestjs/swagger/v/12.0.1), para la
  versión y peers a resolver mediante pnpm.
- [Zod JSON Schema](https://zod.dev/json-schema), contrastado con las declaraciones instaladas de
  Zod 4.5.4.

## Diseño propuesto

### Configuración y bootstrap

Crear `src/config/openapi.config.ts` con un namespace cohesivo `openapi`, limitado a:

```text
OPENAPI_ENABLED=false
OPENAPI_DOCS_ROUTE=docs
OPENAPI_DOCUMENT_ROUTE=openapi.json
```

La factory debe seguir el patrón actual: leer solo el entorno, normalizar, construir el valor final,
validarlo una vez con Zod y exponer un tipo de solo lectura registrado con `registerAs`. Las rutas
serán paths relativos normalizados, no vacíos y sin slash inicial/final, query, fragment, espacios,
segmentos vacíos, `.` ni `..`; además deben ser distintas. No se añadirá metadata ni lógica de
Swagger al namespace.

Registrar el namespace desde `AppModule`. En `main.ts`, obtener los valores tipados de `appConfig` y
`openapiConfig` y, después de aplicar el bootstrap HTTP común, llamar a una función pequeña de
infraestructura, por ejemplo `setupOpenApi(app, appConfig, openapiConfig)`.

Cuando `enabled` sea `false`, la función no debe registrar UI, JSON ni dependencias de rutas. Cuando
sea `true`, debe:

1. construir el documento con `DocumentBuilder` usando exactamente `appConfig.name`,
   `appConfig.description` y `appConfig.version`;
2. generar el documento desde una lista explícita de módulos públicos, inicialmente `HealthModule`;
3. registrar `SwaggerModule.setup()` con `useGlobalPrefix: false`, la ruta de UI configurada y una
   `jsonDocumentUrl` explícita que resulte en `/openapi.json` por defecto;
4. usar únicamente la opción de `@nestjs/swagger@12.0.1` verificada en la fase de dependencias para
   habilitar JSON y suprimir YAML, la ruta JSON por defecto y toda ruta auxiliar de documento. La
   hipótesis `raw: ['json']` no sustituye esta verificación;
5. mantener ambas rutas fuera de controladores versionados.

La lista explícita es un límite de publicación: un Feature que publique un controller debe añadirse
con sus tests y decoradores OpenAPI en la misma unidad de trabajo. `ErrorHandlingModule` no se
incluye, por lo que `NotFoundController` no aparece. Los controllers de `test/support/` tampoco
aparecen porque no pertenecen al grafo productivo ni a la lista de módulos públicos.

### Adaptador de schemas y contratos compartidos

Crear un único helper de infraestructura OpenAPI, sin clases DTO, que reciba un schema Zod y delegue
a la API verificada `z.toJSONSchema`. Su contrato debe hacer explícita la dirección `input` u
`output` y devolver el schema que acepta `@nestjs/swagger`; no debe inferir tipos locales ni alterar
semántica, required fields, nullability, defaults o transforms.

- `healthResponseSchema` permanece en `src/modules/health/contracts/health-response.schema.ts`; las
  dos respuestas exitosas de health usan su conversión de salida directa.
- El owner de errores crea/exporta `errorResponseSchema` (y, si resulta necesario para una futura
  proyección pública, una fábrica de schema de `details` tipada) desde `src/common/error-handling/`.
  `ErrorResponse` se deriva en el mismo owner. Cada operación de health declara `200` y `503` con la
  conversión de salida de `healthResponseSchema`: Terminus usa su payload de health canónico también
  cuando el servicio no está disponible. Conserva `500` únicamente para errores inesperados con la
  conversión canónica compartida de `errorResponseSchema`; no documenta otros status teóricos. Esa
  respuesta no modela causes, stacks, issues, valores rechazados ni detalles internos. El catch-all
  permanece excluido del documento.
- El controller declara solo metadata de transporte: `@ApiOperation` con el ID explícito y
  `@ApiResponse`/equivalente con `schema` obtenido del helper canónico. No declara clases anotadas,
  `@ApiProperty`, `@ApiExtraModels` ni una interfaz paralela.
- Los IDs iniciales serán `healthLive` y `healthReady`. La prueba de documento debe verificar tanto
  sus nombres como su unicidad global; un rename es un cambio contractual.

Las operaciones incluidas deben reflejar las rutas con prefijo y versión publicados
(`/api/v1/health/live` y `/api/v1/health/ready` con la configuración predeterminada). La UI y el
JSON no reciben el prefijo ni `v1`: `/docs` y `/openapi.json` son endpoints operativos de
documentación, no endpoints de la API versionada.

### Seguridad: Helmet y rutas de documentación

La UI se instala después de `setupApplication()`, por lo que debe conservar los headers de Helmet,
correlación y logging del pipeline Express. La implementación no debe desactivar Helmet ni su CSP a
nivel global para que Swagger UI funcione.

Swagger UI suele requerir recursos y bootstrap inline. Antes de GREEN, una prueba real debe
inspeccionar el HTML y su `content-security-policy` bajo la configuración actual. Si el CSP por
defecto bloquea la UI, aplicar solo una política documentada y limitada a la ruta configurada de
docs (incluyendo sus assets), con la relajación mínima demostrada. Registrar esa excepción, su
justificación y sus headers en `docs/configuration/http-security.md`; conservar el JSON bajo la
política global y no añadir CORS, autenticación, secrets ni fuentes remotas implícitas. La prueba
debe impedir que la excepción se extienda a health u otras rutas.

## Plan TDD estricto

### Fase 1 — evidencia y RED de configuración

1. Confirmar `@nestjs/swagger@12.0.1`, sus peers de NestJS 12 y las opciones efectivas de
   `SwaggerModule.setup()` contra el package resuelto antes de escribir integración, incluida la
   configuración exacta que expone solo `/docs` y `/openapi.json` y suprime YAML, documento JSON por
   defecto y rutas auxiliares.
2. Añadir RED para la factory `openapi`: `false` por defecto, rutas por defecto, override válido,
   rutas malformadas, rutas iguales y valores booleanos inválidos.
3. Añadir RED para el registro de `openapiConfig` y para que `setupOpenApi` no registre nada cuando
   está deshabilitado.
4. Añadir RED para el helper Zod: `io: 'output'` conserva el contrato de health y `io: 'input'`
   representa el boundary de entrada cuando haya transform.

**Salida:** el feature permanece apagado por defecto y la conversión se apoya en la API instalada,
no una aproximación escrita a mano.

### Fase 2 — GREEN mínimo del documento canónico

1. Añadir la dependencia de producción y actualizar el lockfile mediante pnpm; no añadir adaptadores
   Zod-a-Swagger ni dependencias de DTO/`class-validator`.
2. Implementar la configuración y el helper mínimo.
3. Introducir el schema Zod canónico de error en su owner y derivar el tipo existente sin cambiar la
   forma observable de las respuestas.
4. Declarar en `HealthController` los dos operation IDs y Responses a partir de los schemas
   convertidos directamente.
5. Implementar la creación del documento solo para módulos productivos publicados y sus rutas de
   exposición condicionales.
6. Extender `createE2EApplication` para reutilizar `setupOpenApi` después de `setupApplication()`.
   Sus opciones deben aceptar overrides tipados de `appConfig` y `openapiConfig`, aplicar
   `overrideProvider(...KEY).useValue(...)` antes de compilar y obtener los valores tipados del
   contenedor antes de llamar a ambos bootstraps. Las pruebas E2E no mutan ni leen `process.env`;
   construyen los overrides mediante las factories tipadas.

### Fase 3 — TRIANGULATE el documento determinista

1. Añadir una prueba de generación in-process que cree la aplicación real y compare selectivamente
   un objeto estable: `info`, `paths`, métodos, operation IDs, schemas de health y el Error Response
   compartido. No usar snapshots opacos del documento completo.
2. Comprobar que cada operation ID es no vacío y único; que los IDs exactos de health se conservan;
   y que las rutas contienen el prefijo/versionado configurados.
3. Verificar que no hay paths o tags de `NotFoundController`, `__test`, rate limit, serialización,
   validación ni manejo de errores E2E.
4. Verificar que cada operación de health documenta exactamente `200`, `500` y `503`: `200` y `503`
   usan el schema de health canónico porque Terminus devuelve ese payload cuando no está disponible,
   y `500` usa únicamente el ErrorResponse compartido para errores inesperados. No se anuncian otros
   status teóricos ni el catch-all.
5. Triangular la configuración con prefijo global vacío: el documento debe reflejar `/v1/health/*`,
   mientras que UI y JSON permanecen en sus rutas operativas sin versión.
6. Probar que `ErrorResponse` documentado no ofrece `details` no tipados ni campos prohibidos, y que
   el schema de health sigue siendo su owner canónico, no una copia en el test o controller.

### Fase 4 — TRIANGULATE por HTTP real

1. Extender el único registrador `test/main.e2e-spec.ts` con una suite OpenAPI; cada escenario usa
   `runScenario` y `createE2EApplication`, que reutiliza `setupApplication()` y `setupOpenApi()`.
   Los escenarios pasan `appConfig` y `openapiConfig` tipados como overrides; queda prohibido leer o
   mutar `process.env` en pruebas.
2. Con la configuración predeterminada, comprobar que `/docs` y `/openapi.json` responden `404` y
   que no aparecen por accidente bajo `/api`, `/api/v1` o `/v1`.
3. Con overrides tipados que habilitan OpenAPI, comprobar `200` de exactamente `/openapi.json` y
   `/docs`, metadata tomada de los overrides de `appConfig`, paths versionados, IDs estables y
   ausencia de controllers excluidos.
4. Añadir aserciones negativas de rutas: YAML, la ruta JSON por defecto y cualquier ruta auxiliar de
   documento deben responder `404`; tampoco se expondrán variantes bajo prefijo o versión.
5. Probar rutas configuradas válidas y confirmar que las rutas por defecto dejan de estar expuestas.
6. Verificar `X-Request-Id`, headers de Helmet y el comportamiento CORS actual. Si existe una
   excepción de CSP para UI, afirmar que es exclusiva de docs; JSON y health conservan la política
   global aplicable.
7. Mantener los fixtures de E2E fuera del documento en lugar de ocultarlos con filtros ad hoc.

### Fase 5 — REFACTOR, documentación y cierre

1. Eliminar helpers, metadata o tipos duplicados; conservar los schemas junto a sus owners.
2. Actualizar `docs/api/openapi.md` con exposición condicional, rutas externas al
   prefijo/versionado, operación estable, conversión Zod y límite de módulos públicos.
3. Actualizar `docs/architecture/configuration.md` con el límite arquitectónico del namespace
   `openapi`, su registro tipado y la dependencia del bootstrap; mantener variables, defaults y
   operaciones en sus owners correspondientes.
4. Actualizar `docs/configuration/http-security.md` con variables, defaults, validación de rutas y
   la excepción Helmet/CSP únicamente si la evidencia obliga a introducirla.
5. Actualizar `docs/testing/e2e-testing.md` con la suite, rutas apagadas/activas y el criterio de
   exclusión de fixtures.
6. Tras pasar todas las verificaciones, actualizar ambas versiones de
   `baseline-operational-completion` con evidencia de OB-07 y cambiar su estado en la misma
   transacción. Este plan no altera el baseline.

## Archivos probables

```text
package.json
pnpm-lock.yaml

src/config/openapi.config.ts
src/config/openapi.config.spec.ts
src/common/openapi/openapi-schema.ts
src/common/openapi/openapi-schema.spec.ts
src/common/openapi/openapi.setup.ts
src/common/openapi/openapi.setup.spec.ts
src/common/error-handling/error-response.ts
src/common/error-handling/error-response.spec.ts
src/app.module.ts
src/main.ts
src/modules/health/health.controller.ts

test/support/create-e2e-application.ts
test/support/create-e2e-application.spec.ts
test/common/openapi/openapi.e2e-suite.ts
test/main.e2e-spec.ts

docs/api/openapi.md
docs/architecture/configuration.md
docs/configuration/http-security.md
docs/testing/e2e-testing.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

La implementación debe confirmar esta lista antes de editar. En particular, solo añadirá un archivo
de módulo OpenAPI si el provider tiene una responsabilidad real; el bootstrap condicional y el
conversor puro no justifican un Feature artificial. No debe modificar `app.config.ts` para duplicar
metadata, ni `app.setup.ts` salvo que la evidencia de una política Helmet limitada requiera el punto
de integración más pequeño.

## Verificación requerida

Ejecutar primero las pruebas de cada slice RED/GREEN y luego, como mínimo:

```bash
pnpm exec vitest run src/config/openapi.config.spec.ts
pnpm exec vitest run src/common/openapi
pnpm exec vitest run src/common/error-handling/error-response.spec.ts
pnpm test:e2e
pnpm exec prettier --check .
pnpm lint
pnpm lint:md
pnpm test
pnpm test:e2e
pnpm build
```

Antes de Markdown lint, aplicar Prettier con escritura solo a los Markdown editados. Antes de una
revisión RDD, ejecutar el `lint-staged` configurado sobre los archivos previstos hasta que una
segunda ejecución no produzca cambios, conforme a `AGENTS.md`.

## Riesgos y mitigaciones

| Riesgo                                       | Mitigación                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Swagger y Zod divergen del contrato real     | Convertir solo schemas owners, probar fragmentos deterministas del documento y no crear DTOs.                                    |
| Documento incluye rutas internas             | Usar lista explícita de módulos públicos y afirmar la ausencia de catch-all/`__test`.                                            |
| Docs publicados involuntariamente            | Default `OPENAPI_ENABLED=false` y E2E explícito de `404` cuando está deshabilitado.                                              |
| Rutas bajo prefijo o versión accidentalmente | `useGlobalPrefix: false`, rutas operativas independientes y pruebas con prefijo normal/vacío.                                    |
| Metadata divergente                          | Consumir solo `appConfig`; no crear variables OpenAPI de nombre, descripción o versión.                                          |
| IDs inestables                               | Declararlos literalmente en cada operación y verificar identidad/duplicados en generación.                                       |
| Swagger UI rompe CSP o debilita toda la API  | Probar Helmet real; limitar cualquier excepción comprobada a docs y documentarla.                                                |
| Error schema expone información interna      | Schema canónico sin cause, stack, issues ni valores rechazados; pruebas negativas de documento y HTTP.                           |
| Cambios de package incompatibles             | Resolver `@nestjs/swagger@12.0.1` con peers de NestJS 12 antes de GREEN y detener la implementación si pnpm evidencia conflicto. |

## Criterios de aceptación

- [ ] `@nestjs/swagger@12.0.1` está resuelto con peers compatibles con NestJS 12.
- [ ] OpenAPI está deshabilitado por defecto y no registra `/docs` ni `/openapi.json` cuando está
      deshabilitado.
- [ ] Al habilitarse, las rutas por defecto son públicas, no versionadas y externas al prefijo
      global.
- [ ] Título, descripción y versión del documento proceden de `appConfig`.
- [ ] El namespace `openapi` solo controla habilitación y rutas validadas.
- [ ] Health y Error Response usan sus schemas Zod canónicos convertidos directamente; no existen
      DTOs Swagger ni contratos/tipos paralelos.
- [ ] Todas las operaciones publicadas incluidas tienen operation IDs explícitos, únicos y estables.
- [ ] El documento incluye rutas productivas publicadas y excluye catch-all y controllers E2E.
- [ ] Las pruebas deterministas de generación y las pruebas HTTP cubren modo apagado, modo
      habilitado, rutas, metadata, versión/prefijo, exclusiones, headers y Helmet; el bootstrap E2E
      reutiliza `setupOpenApi` con overrides tipados y sin `process.env`.
- [ ] Al habilitarse, se exponen exactamente `/docs` y `/openapi.json`; YAML, documento JSON por
      defecto, rutas auxiliares y variantes bajo prefijo/versionado responden `404`.
- [ ] Cada operación de health documenta exactamente `200`, `500` y `503`: `200` y `503` usan el
      schema de health canónico y `500` usa ErrorResponse solo para errores inesperados; no anuncia
      otros status teóricos ni el catch-all.
- [ ] Las actualizaciones de owners, configuración, testing y ambos baselines ocurren solo con
      implementación y evidencia verificadas.

## Rollback

Revertir en una sola transacción la dependencia, lockfile, namespace, bootstrap condicional, helper,
metadata de controllers, schemas/tipos y pruebas/documentación de OB-07. El rollback debe devolver
la aplicación al estado sin rutas Swagger y sin dependencia transitiva de documentación; no dejar
rutas docs activas, un schema de error a medio migrar ni referencias a metadata OpenAPI duplicada.

## Siguiente paso

Aprobar este plan y ejecutar OB-07 como una transacción TDD separada, empezando por validar la
resolución efectiva de `@nestjs/swagger@12.0.1` y el RED de configuración apagada. Solo después de
verificación completa se actualizará el estado de OB-07 en ambos baselines.
