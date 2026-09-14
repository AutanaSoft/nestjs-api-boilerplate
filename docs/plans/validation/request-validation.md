# Plan de implementación de validación de Requests

Este plan completa **OB-08** con validación global de entrada basada en Standard Schema, schemas Zod
canónicos y una traducción `400 BAD_REQUEST` estable. No publica un endpoint de negocio: un fixture
HTTP exclusivo de E2E demostrará el pipeline real.

## Resultado esperado

Todo body, query o param que declare un schema canónico se valida y normaliza antes de llegar al
controller. El fallo devuelve exclusivamente el Error Response público existente: `400`,
`BAD_REQUEST`, `The request is invalid.` y `X-Request-Id`; no expone issues de Zod, rutas, valores
rechazados, stack, causa ni detalles tecnológicos.

## Alcance

### Incluido

- Registrar una única instancia global de `StandardSchemaValidationPipe` mediante `APP_PIPE`.
- Configurar `exceptionFactory` para producir una `BadRequestException` sin payload de issues.
- Declarar y consumir schemas Zod de Request como dueños canónicos de sus tipos de entrada y salida
  cuando haya transforms.
- Probar schema, pipe, registro por DI, traducción del Error Boundary y el recorrido HTTP real.
- Documentar las decisiones finales en los documentos owner y actualizar el baseline solo tras
  verificación completa.

### Fuera de alcance

- Publicar endpoints, Features, DTOs paralelos, persistencia, autorización u operaciones de negocio.
- Cambiar el catálogo público de errores, `HttpExceptionFilter`, correlación, logging, CORS,
  throttling, versionado o la serialización de OB-09 salvo que una prueba demuestre una integración
  mínima necesaria.
- Añadir `class-validator`, `class-transformer`, `ValidationPipe`, Swagger/OpenAPI u otra estrategia
  general de validación.
- Emitir `details` de validación o registrar payloads, issues, schemas o valores inválidos.
- Marcar OB-08 como completo ni modificar el estado del baseline en esta unidad de planificación.

## Evidencia y decisiones resueltas

| Tema             | Decisión y evidencia                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API oficial      | NestJS documenta la validación HTTP mediante pipes en [Validation](https://docs.nestjs.com/techniques/validation). La implementación deberá reconfirmar este enlace y su compatibilidad con NestJS 12 antes de consolidar la API interna.                                                                                                                                                                                                       |
| API instalada    | `@nestjs/common@12.0.1` expone `StandardSchemaValidationPipe`. Su declaración local acepta `transform`, `validateCustomDecorators`, `validateOptions`, `errorHttpStatusCode` y `exceptionFactory`; su implementación toma `metadata.schema`, llama a `schema['~standard'].validate()`, usa `transform: true` por defecto y por defecto crea un `400`. Evidencia: `node_modules/@nestjs/common/pipes/standard-schema-validation.pipe.{d.ts,js}`. |
| Registro         | Crear `ValidationModule` transversal en `src/common/validation/`, con un único `APP_PIPE`, e importarlo una vez desde `AppModule`. Así producción y E2E comparten DI y no se añade configuración divergente en `main.ts`, `setupApplication()` ni el bootstrap E2E.                                                                                                                                                                             |
| Falla controlada | El provider construye `StandardSchemaValidationPipe` con `exceptionFactory: () => new BadRequestException()`; los issues no se adjuntan a la excepción. `HttpExceptionFilter` ya reconstruye cualquier `HttpStatus.BAD_REQUEST` permitido con el descriptor público inmutable y no usa `getResponse()`.                                                                                                                                         |
| Ownership        | El schema pertenece al Feature que posee el endpoint; para el fixture, al soporte E2E que posee solo esa ruta. El owner exporta schema y tipos; consumers los importan, sin DTO equivalente ni `z.infer` local. Un schema depende de Zod y tipos de dominio, no de Nest, Express, logger o persistencia.                                                                                                                                        |
| Transformación   | El pipe entrega el resultado normalizado del schema. Cuando un transform cambie el tipo, el owner exporta `z.input` y `z.output`; coercion solo en body/query/params externos, y transforms/refinements son puros y deterministas.                                                                                                                                                                                                              |
| E2E              | No existe endpoint productivo con Request contract. El fixture versionado `__test/validation` es la mínima ruta que permite demostrar metadata, pipe global, filtro, correlación y respuesta HTTP real sin ampliar la API publicada.                                                                                                                                                                                                            |

La decisión de `APP_PIPE` sigue la propiedad transversal de `src/common`; no crea un Feature
artificial. Los schemas de un Feature futuro permanecerán bajo `src/modules/<feature>/contracts/`
según `project-structure.md` y `http-contracts.md`.

## Arquitectura objetivo

```text
HTTP Request
  -> metadata.schema del parámetro decorado
  -> StandardSchemaValidationPipe global (APP_PIPE)
     -> schema canónico Zod / Standard Schema
     -> valor transformado y tipado
  -> Controller
  -> Service

schema inválido
  -> BadRequestException sin issues
  -> HttpExceptionFilter existente
  -> { statusCode: 400, code: "BAD_REQUEST", message, requestId }
```

El pipe no interpreta reglas de negocio ni consulta infraestructura. El Error Boundary sigue siendo
el único responsable de traducir HTTP y reconstruye la respuesta desde la allowlist; por ello no hay
filtración aunque el framework cambie el texto interno de un issue. Un `400` esperado no emite
`http.request.failed`; el evento terminal existente conserva el status final y no registra el body.

## Archivos probables

```text
src/common/validation/
├── validation.module.ts
├── validation.module.spec.ts
└── standard-schema-validation.pipe.spec.ts

src/app.module.ts
test/support/e2e-request-validation.controller.ts
test/modules/validation/request-validation.e2e-suite.ts
test/main.e2e-spec.ts

docs/architecture/validation.md
docs/architecture/error-handling.md
docs/api/http-contracts.md
docs/testing/e2e-testing.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

La lista se confirmará antes de editar. Los documentos owner solo recibirán decisiones que queden
implementadas; el baseline conservará OB-08 como pendiente hasta la evidencia final. Si la prueba de
módulo demuestra que no requiere cambios de `AppModule` o una suite compartida, se eliminará ese
archivo de la transacción.

## Plan TDD por fases

### Fase 1 — Confirmar contrato y preparar RED

1. Reconfirmar en lockfile y en la API local efectiva `StandardSchemaValidationPipe`, `APP_PIPE`,
   `BadRequestException` y el uso de `metadata.schema`.
2. Definir el schema Zod del fixture E2E con una transformación observable y exportar sus tipos en
   su owner; preparar un payload válido fresco y variantes inválidas que cambien una sola condición.
3. **RED:** añadir pruebas unitarias que demuestren que el pipe entrega el valor transformado y que
   un schema inválido produce una excepción `400` sin issues, valor rechazado o mensaje de Zod.
4. **RED:** añadir una prueba del módulo para exigir un único `APP_PIPE` resuelto por DI.

**Salida:** el fallo describe el contrato de entrada, no detalles privados de la implementación.

### Fase 2 — GREEN mínimo del boundary de validación

1. Crear `ValidationModule` y registrar el pipe nativo con `transform` efectivo y la
   `exceptionFactory` cerrada.
2. Importarlo una vez en `AppModule`; no registrar pipes en bootstraps alternativos.
3. **GREEN:** hacer pasar las pruebas de pipe y módulo sin copiar el algoritmo de NestJS ni acceder
   directamente a sus internals.
4. **REFACTOR:** eliminar tipos o helpers duplicados; conservar `unknown` en el límite y
   `import type` para dependencias exclusivamente estáticas.

**Salida:** el valor validado y normalizado llega al handler a través del mecanismo nativo único.

### Fase 3 — TRIANGULATE el contrato y la traducción

1. **RED:** ampliar `http-error-mapping.spec.ts` y/o `http-exception.filter.spec.ts` solo si falta
   evidencia de que una `BadRequestException` con datos hostiles se reconstruye como el descriptor
   `BAD_REQUEST` sin `details` ni filtraciones.
2. **GREEN:** realizar el cambio mínimo estrictamente necesario; si la cobertura existente ya prueba
   esa garantía, no modificar el Error Boundary.
3. **TRIANGULATE:** cubrir éxito transformado, campo ausente, tipo inválido, propiedad adicional si
   el schema la rechaza, y que errores `404`, `429` y `500` existentes no cambian.
4. **REFACTOR:** mantener schema, tipo y fixture con owners únicos; no introducir DTOs ni tipos
   manuales equivalentes.

**Salida:** la traducción de un Request inválido es estable, correlacionada y libre de issues.

### Fase 4 — Probar por HTTP real

1. Registrar el controller `E2ERequestValidationController` únicamente en
   `create-e2e-application.ts`, siguiendo los fixtures existentes de serialización y errores.
2. Registrar `request-validation.e2e-suite.ts` desde el único owner descubierto,
   `test/main.e2e-spec.ts`; cada escenario crea y cierra su propia aplicación mediante
   `runScenario`.
3. **RED:** probar por HTTP un payload válido que demuestre el transform, y uno inválido que
   produzca el Error Response exacto con `X-Request-Id === body.requestId`.
4. **GREEN:** conectar solamente el schema del fixture al parámetro del controller según la metadata
   soportada por NestJS 12.
5. **TRIANGULATE:** afirmar ausencia de issues, paths, valores enviados, stack, cause, schema y
   `details`; comprobar que no se genera `http.request.failed` y que el único evento terminal usa
   `400`.
6. **REFACTOR:** conservar el fixture fuera de `src/`, sin estado compartido, seeds ni mocks de
   controllers, pipe, filtro, logger o bootstrap.

**Salida:** la aplicación real prueba el pipeline de producción sin crear API de negocio.

### Fase 5 — Cierre de documentación y evidencia

1. Actualizar `architecture/validation.md` con registro, metadata, transformación y límites del
   pipe.
2. Actualizar `architecture/error-handling.md` y `api/http-contracts.md` únicamente si la
   implementación confirma una convención aún no expresada; no duplicar reglas entre owners.
3. Actualizar `testing/e2e-testing.md` con el motivo y límite del fixture si cambia la convención
   E2E.
4. Tras todas las verificaciones, sincronizar evidencia, dependencias y aceptación de OB-08 en ambas
   versiones del baseline y cambiar su estado en la misma transacción.

**Salida:** documentación, implementación y evidencia final coinciden; este plan por sí solo no
cambia el baseline.

## Estrategia de verificación

Primero, durante cada ciclo, ejecutar el objetivo más pequeño afectado. Antes de revisión, ejecutar:

```bash
pnpm exec vitest run src/common/validation
pnpm exec vitest run src/common/error-handling
pnpm test:e2e
pnpm exec prettier --check .
pnpm lint
pnpm lint:md
pnpm test
pnpm test:e2e
pnpm build
```

Para Markdown editado, ejecutar primero Prettier con escritura solo sobre los documentos afectados y
luego `markdownlint-cli2`; no aplicar formateo global que escriba fuera de la transacción. El flujo
`lint-staged` se ejecutará conforme a `AGENTS.md` antes de una revisión RDD y debe ser idempotente
en una segunda ejecución.

## Riesgos y mitigaciones

| Riesgo                     | Mitigación                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Filtrar issues o payload   | `exceptionFactory` sin payload, filtro que reconstruye desde allowlist y pruebas negativas de HTTP/logs.                |
| Duplicar validación        | Delegar en `StandardSchemaValidationPipe`; no reimplementar `~standard.validate()`.                                     |
| Dos registros globales     | Un `ValidationModule`, un `APP_PIPE`, una importación de `AppModule` y prueba DI.                                       |
| Schema y tipo divergentes  | Schema como única fuente; tipos exportados por su owner y consumers sin inferencia local.                               |
| Transformar datos internos | Coercion y transforms solo en el boundary; schemas puros, sin I/O ni autorización.                                      |
| Confundir fixture con API  | Controller y schema de demostración en `test/`, registrados solo por bootstrap E2E.                                     |
| Regresión transversal      | Ejecutar error handling y E2E completos; preservar correlación, logs, throttling y versionado.                          |
| API instalada distinta     | Reconfirmar versión efectiva y firmas locales antes de GREEN; detener y actualizar el plan si difieren de la evidencia. |

## Criterios de aceptación

- [ ] Existe un único `APP_PIPE` global basado en `StandardSchemaValidationPipe` de NestJS 12.
- [ ] Los parámetros con schema reciben el valor validado y transformado antes del controller.
- [ ] Cada schema y tipo tienen un owner canónico; no existen DTOs ni tipos paralelos.
- [ ] Un Request inválido devuelve el `400 BAD_REQUEST` exacto, con correlación consistente y sin
      `details`.
- [ ] HTTP, logs y excepciones públicas no exponen issues, paths, valores rechazados, stack, cause
      ni detalles del schema.
- [ ] El fixture de validación solo existe en E2E y no publica un endpoint productivo.
- [ ] Las pruebas enfocadas, E2E, formato, lint y build terminan correctamente.
- [ ] Los documentos owner y ambas versiones del baseline se actualizan solo con evidencia
      verificada.

## Rollback

Revertir la transacción de OB-08 completa: módulo/registro, schemas y fixtures de prueba, pruebas y
actualizaciones documentales. Restaurar el baseline y los documentos owner al estado previo si la
implementación no supera la verificación. No dejar un `APP_PIPE` parcialmente registrado ni un
fixture E2E sin su suite.

## Siguiente paso

Aprobar este plan y ejecutar OB-08 en una transacción TDD separada, empezando por confirmar la API
instalada y el primer RED del pipe. Después de evidencia completa, actualizar el baseline; solo
entonces OB-07 podrá reutilizar los schemas canónicos sin duplicar ownership.
