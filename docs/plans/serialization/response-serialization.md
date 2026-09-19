# Plan de implementación de serialización de Responses

Este plan define cómo completar **OB-09** mediante contratos de salida canónicos y un único mecanismo de serialización
basado en Standard Schema, reutilizando el Error Boundary de OB-10 para tratar de forma segura los incumplimientos
internos.

## Resultado esperado

Al finalizar, cada operación HTTP que publique una Response JSON estructurada deberá declarar su Response Schema
canónico. Un interceptor global validará y transformará el valor retornado antes de enviarlo, los modelos internos no se
expondrán implícitamente y cualquier incumplimiento del contrato de salida producirá el Error Response seguro de OB-10.

## Alcance

### Incluido

- Verificar y adoptar `StandardSchemaSerializerInterceptor` de NestJS 12 como mecanismo base.
- Definir una integración global que permanezca inerte cuando una operación no declare schema.
- Definir schemas Zod canónicos de Response junto con sus tipos de salida.
- Aplicar `@SerializeOptions({ schema })` a las operaciones JSON estructuradas incluidas en el alcance.
- Crear una representación interna reconocible para fallos del contrato de salida.
- Integrar esos fallos con `HttpExceptionFilter` sin exponer issues, valores inválidos ni detalles del runtime.
- Proteger el contrato público frente a propiedades internas adicionales.
- Cubrir schemas, transformación, registro global, errores y comportamiento HTTP real.
- Actualizar los documentos owner y la evidencia del baseline una vez verificada la implementación.

### Fuera de alcance

- Implementar Request validation o `StandardSchemaValidationPipe`, pertenecientes a OB-08.
- Configurar Swagger/OpenAPI, perteneciente a OB-07.
- Diseñar contratos de módulos de negocio todavía inexistentes.
- Introducir `ClassSerializerInterceptor`, `class-transformer` o una segunda estrategia general de serialización.
- Convertir automáticamente modelos de persistencia en Responses públicas.
- Definir reglas de autorización o ejecutar I/O desde mappers.
- Forzar archivos, streams u otras Responses especiales a través de schemas de objeto.
- Cambiar el catálogo público de errores, la política de correlación o el backend de logging.
- Incorporar métricas o trazas, diferidas en OB-14.

## Dependencias y documentos owner

La implementación debe respetar:

- [Serialización](../../architecture/serialization.md): límite de salida, Standard Schema, mappers, persistencia y
  excepciones explícitas.
- [Contratos HTTP](../../api/http-contracts.md): ownership, separación de representaciones, ausencia, nullability y
  Error Response público.
- [Manejo de errores](../../architecture/error-handling.md): clasificación interna `ResponseContractViolation` y
  traducción mediante el Error Boundary.
- [Convenciones de API](../../api/conventions.md): semántica de Responses y HTTP Status Codes.
- [Paginación](../../api/pagination.md): forma compartida de futuras colecciones paginadas.
- [Observabilidad](../../architecture/observability.md): correlación, logging estructurado y protección de datos
  sensibles.
- [Pruebas](../../testing/testing.md) y [pruebas E2E](../../testing/e2e-testing.md): niveles, aislamiento y verificación
  mediante la aplicación real.
- [Baseline operacional](../baseline-operational-completion.md): dependencias y evidencia requerida para completar
  OB-09.

OB-10 ya proporciona `HttpExceptionFilter`, el contrato público `INTERNAL_SERVER_ERROR` y el logging correlacionado de
fallos inesperados. OB-09 debe reutilizar ese boundary sin crear un filtro, contexto o backend de logging paralelo.

La versión instalada `@nestjs/common@12.0.1` expone `StandardSchemaSerializerInterceptor` y `SerializeOptions`. El
interceptor consulta metadata de handler o controller, omite la transformación cuando no existe schema y usa
`schema['~standard'].validate()` para validar y transformar el valor. Esta API debe confirmarse nuevamente contra la
versión efectiva del lockfile antes de implementar.

## Decisiones de implementación

Las decisiones necesarias para iniciar OB-09 quedan resueltas en este plan. Si la evidencia de TDD demuestra una
incompatibilidad con NestJS 12, Zod 4 o Terminus, debe actualizarse primero el documento owner correspondiente.

<!-- markdownlint-disable MD013 -->

| Decisión                | Decisión adoptada                                                                                                    | Criterio de aceptación                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro                | **Resuelta:** registrar un interceptor transversal mediante un único `APP_INTERCEPTOR`                               | `AppModule` importa una sola vez el módulo owner; producción y E2E comparten el registro, y handlers sin schema conservan su comportamiento.         |
| Implementación          | **Resuelta:** extender `StandardSchemaSerializerInterceptor` solo para traducir fallos a `ResponseContractViolation` | Se conserva la selección de schema y transformación nativa; no se copia el algoritmo del framework ni se introduce otra estrategia general.          |
| Declaración             | **Resuelta:** usar `@SerializeOptions({ schema })` explícitamente por handler o controller                           | Cada Response JSON estructurada incluida tiene un schema reconocible desde su boundary; no existe un schema global permisivo por defecto.            |
| Ownership               | **Resuelta:** ubicar cada schema y tipo de Response en el Feature que posee el endpoint                              | Los consumidores importan el contrato canónico; no se duplican formas equivalentes en controllers, pruebas u OpenAPI.                                |
| Tipos                   | **Resuelta:** derivar el tipo de salida desde el schema Zod owner                                                    | El schema es la fuente de verdad; no se mantiene una interface manual equivalente y las transformaciones distinguen input de output cuando difieren. |
| Propiedades adicionales | **Resuelta:** proyectar únicamente las claves públicas declaradas por el schema                                      | Una propiedad interna adicional no aparece en HTTP; la prueba demuestra la exclusión sin depender de serialización implícita.                        |
| Mappers                 | **Resuelta:** crear un mapper puro solo cuando el resultado interno no coincida semánticamente con la Response       | El controller no expone modelos internos; el mapper no contiene I/O, autorización ni reglas de negocio.                                              |
| Fallos de salida        | **Resuelta:** lanzar `ResponseContractViolation` desde el wrapper del interceptor                                    | El tipo no contiene semántica HTTP ni datos inválidos; OB-10 responde `500`, `INTERNAL_SERVER_ERROR`, mensaje seguro y sin `details`.                |
| Colecciones             | **Resuelta:** serializar el envelope paginado como contrato único conforme a `pagination.md`                         | No se aplica un schema de elemento directamente a un envelope ni se inventa una segunda forma de paginación.                                         |
| Responses especiales    | **Resuelta:** excluir explícitamente archivos, streams y respuestas sin body                                         | El mecanismo no altera `StreamableFile`, `204` ni boundaries que documenten una estrategia especializada.                                            |
| Primer contrato         | **Resuelta:** usar health como primer contrato productivo verificable                                                | `live` y `ready` conservan su contrato público actual, pero dejan de publicar directamente una forma implícita de Terminus.                          |

<!-- markdownlint-enable MD013 -->

## Diseño propuesto

### Flujo de salida

```text
Service Result
    │
    ├─> Mapper puro, cuando exista transformación semántica
    │
    └─> Controller return value
             │
             └─> ResponseSchemaSerializerInterceptor
                      │
                      ├─> schema válido ──> Response pública proyectada
                      │
                      └─> fallo ──────────> ResponseContractViolation
                                                   │
                                                   └─> HttpExceptionFilter
                                                        └─> Error Response 500 seguro
```

El interceptor debe recibir el valor como desconocido en el boundary del schema y delegar la validación y transformación
a Standard Schema. Los issues y el valor original pueden existir durante la validación, pero nunca deben formar parte de
la excepción reconocible, los logs o la Response.

### Estructura de archivos prevista

Los nombres de archivos, carpetas, símbolos, códigos y eventos se mantienen en inglés.

```text
src/common/serialization/
├── response-contract-violation.ts
├── response-schema-serializer.interceptor.ts
├── response-schema-serializer.interceptor.spec.ts
├── serialization.module.ts
└── serialization.module.spec.ts

src/modules/health/contracts/
├── health-response.schema.ts
└── health-response.schema.spec.ts
```

Archivos existentes que previsiblemente deberán modificarse:

```text
src/app.module.ts
src/modules/health/health.controller.ts
src/common/error-handling/http-error-mapping.ts
src/common/error-handling/http-error-mapping.spec.ts
src/common/error-handling/http-exception.filter.spec.ts
test/modules/health/health.e2e-suite.ts
test/support/e2e-context.ts
docs/architecture/serialization.md
docs/architecture/error-handling.md
docs/api/http-contracts.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

La lista es una previsión. La implementación deberá confirmar dónde registrar el fixture E2E que provoca una Response
inválida y si `e2e-context.ts` necesita cambios. Cualquier ampliación debe justificarse antes de modificar archivos
fuera de este alcance.

### Responsabilidades

#### Response Schema

- Ser la fuente canónica de la representación pública del endpoint.
- Declarar solo propiedades públicas y su semántica real de ausencia o `null`.
- Derivar y exportar su tipo de salida desde el mismo owner.
- Permanecer libre de NestJS, Express, persistencia, logger e infraestructura.
- Aplicar transformaciones puras y deterministas cuando el contrato lo requiera.
- Evitar `unknown` abierto salvo en una propiedad cuya semántica pública lo justifique y documente.

#### `ResponseSchemaSerializerInterceptor`

- Reutilizar el comportamiento de `StandardSchemaSerializerInterceptor` de NestJS.
- Conservar la resolución de metadata de `@SerializeOptions` por handler o controller.
- Permanecer inerte cuando no exista schema y respetar las Responses especiales soportadas por NestJS.
- Convertir cualquier fallo de validación o transformación del schema en `ResponseContractViolation`.
- No incorporar issues, mensajes variables ni el valor rechazado a la excepción.
- No decidir status, código o mensaje HTTP.

#### `ResponseContractViolation`

- Representar exclusivamente un incumplimiento interno del contrato de salida.
- Ser reconocible por el Error Boundary sin depender del mensaje de `Error` emitido por NestJS.
- No exponer issues, Response original, schema, stack, status ni semántica HTTP.
- Permitir conservar una causa solo para diagnóstico interno cuando la política vigente lo requiera, sin serializarla ni
  registrarla.

#### `SerializationModule`

- Registrar un único `APP_INTERCEPTOR` resuelto mediante DI.
- Exponer solo los providers que otros módulos necesiten realmente.
- Ser importado una sola vez por `AppModule`.
- Evitar registros manuales divergentes en `main.ts`, `setupApplication()` o bootstrap E2E.

#### Mapper de Response

- Construir una representación pública deliberada cuando el resultado interno difiera del contrato.
- Seleccionar, renombrar o convertir campos sin ejecutar I/O.
- Permanecer libre de autorización, decisiones de negocio y acceso a persistencia.
- Ser probado como función pura cuando exista lógica de transformación.

#### Integración con OB-10

- Reconocer `ResponseContractViolation` como fallo interno.
- Reutilizar el descriptor público `500`, `INTERNAL_SERVER_ERROR` y su mensaje exacto.
- Emitir un único `http.request.failed` con clasificación segura y correlación existente.
- Conservar `X-Request-Id` igual a `body.requestId` y el evento terminal con status `500`.
- No registrar issues, valores rechazados, schemas, bodies ni detalles tecnológicos.

## Secuencia de implementación

La ejecución seguirá ciclos **RED, GREEN, TRIANGULATE y REFACTOR**. Cada fase debe conservar en verde las pruebas de las
fases anteriores.

### Fase 1 — Formalizar la integración aprobada

1. Confirmar en la versión instalada y lockfile las APIs públicas de `StandardSchemaSerializerInterceptor`,
   `SerializeOptions` y Standard Schema.
2. Actualizar `serialization.md` con el registro global, declaración explícita de schema, política de propiedades
   adicionales y responsabilidad del wrapper.
3. Actualizar `error-handling.md` con la forma reconocible de `ResponseContractViolation` y su límite de datos.
4. Actualizar `http-contracts.md` solo con convenciones públicas que todavía no estén expresadas, evitando duplicar
   decisiones técnicas.
5. Definir el contrato productivo inicial de health y confirmar que su semántica pública actual no depende
   accidentalmente de detalles privados de Terminus.
6. Confirmar el fixture E2E exclusivo que producirá una Response incompatible sin ampliar la API de producción.

**Salida:** owners alineados y APIs externas verificadas antes de consolidar APIs internas.

### Fase 2 — Definir el contrato canónico de health

1. **RED:** escribir pruebas del schema para la Response válida actual de `live` y `ready`.
2. **RED:** demostrar el comportamiento de campos ausentes, valores inválidos y propiedades adicionales.
3. **GREEN:** implementar el schema Zod en el owner del Feature y derivar su tipo de salida.
4. **TRIANGULATE:** probar al menos un resultado válido no idéntico al fixture mínimo si el contrato admite indicadores
   de dependencias.
5. **REFACTOR:** eliminar tipos duplicados y mantener el schema independiente de NestJS y Terminus.

**Salida:** health posee un contrato público canónico capaz de validar y proyectar su Response.

### Fase 3 — Implementar el interceptor y su fallo reconocible

1. **RED:** probar que una Response válida atraviesa el interceptor y utiliza el valor transformado.
2. **RED:** probar que una Response inválida produce `ResponseContractViolation` sin issues ni valor rechazado.
3. **RED:** probar que la ausencia de schema y `StreamableFile` conservan el comportamiento nativo.
4. **GREEN:** implementar el wrapper mínimo sobre `StandardSchemaSerializerInterceptor`.
5. **TRIANGULATE:** cubrir schema síncrono, schema asíncrono y error lanzado durante la transformación.
6. **REFACTOR:** eliminar cualquier duplicación del algoritmo o acceso a metadata del framework.

**Salida:** existe un boundary de serialización reutilizable con fallos internos estables y seguros.

### Fase 4 — Registrar el mecanismo transversal

1. **RED:** escribir una prueba de módulo que demuestre un único provider `APP_INTERCEPTOR`.
2. **RED:** demostrar que el interceptor global permanece inerte para un handler sin schema.
3. **GREEN:** crear `SerializationModule`, registrar el interceptor e importarlo una sola vez en `AppModule`.
4. **GREEN:** aplicar `@SerializeOptions({ schema })` a `live` y `ready`.
5. **TRIANGULATE:** comprobar que producción y el bootstrap E2E resuelven la misma instancia por DI.
6. **REFACTOR:** eliminar registros manuales o exports innecesarios.

**Salida:** todas las aplicaciones comparten un único mecanismo y health declara su contrato.

### Fase 5 — Integrar fallos de salida con el Error Boundary

1. **RED:** probar el mapping de `ResponseContractViolation` a la representación interna de fallo inesperado.
2. **RED:** probar que `HttpExceptionFilter` responde `500`, `INTERNAL_SERVER_ERROR`, mensaje seguro y sin `details`.
3. **RED:** demostrar que el diagnóstico usa una clasificación estable y no contiene issues, schema, Response original
   ni causa.
4. **GREEN:** ampliar el narrowing del Error Boundary con la clasificación aprobada.
5. **TRIANGULATE:** comprobar que un `Error` desconocido continúa usando su fallback y que los errores esperados no
   cambian.
6. **REFACTOR:** mantener la traducción HTTP confinada a OB-10 y la serialización confinada a OB-09.

**Salida:** un incumplimiento de salida alcanza el contrato público seguro sin atribuirse al cliente.

### Fase 6 — Verificar los contratos por HTTP real

Extender la suite E2E para demostrar que:

1. `live` y `ready` conservan status `200` y la forma pública canónica;
2. propiedades internas adicionales del valor retornado no aparecen en la Response;
3. un fixture E2E con schema válido demuestra la transformación real, no solo el tipado estático;
4. un fixture E2E con Response inválida devuelve `500`, `INTERNAL_SERVER_ERROR` y mensaje seguro;
5. el fallo no expone issues, valor rechazado, stack, causa, schema ni detalles tecnológicos;
6. `X-Request-Id` coincide con `body.requestId` en el Error Response;
7. se emite un único evento `http.request.failed` con clasificación segura y correlación;
8. `http.request.completed` conserva el status final `500` sin duplicarse;
9. handlers sin schema, rutas inexistentes, throttling, CORS y versioning no presentan regresiones.

Los endpoints y providers que fuerzan valores válidos o inválidos deberán existir únicamente en el entorno E2E y no
ampliar la API publicada de producción.

**Salida:** evidencia del límite de salida sobre la aplicación real y el pipeline compartido.

### Fase 7 — Cerrar evidencia y documentación

1. Ejecutar pruebas enfocadas durante cada ciclo TDD.
2. Revisar que cada Response JSON estructurada productiva existente tenga un schema o una excepción explícita
   documentada.
3. Ejecutar el flujo de `lint-staged` sobre los archivos previstos hasta que una segunda ejecución no produzca cambios.
4. Ejecutar la verificación completa del repositorio.
5. Actualizar los documentos owner con las decisiones finales y referencias a la implementación.
6. Actualizar ambas versiones de `baseline-operational-completion` con estado, evidencia, dependencias y aceptación
   equivalentes.
7. Marcar OB-09 como completa únicamente cuando la implementación y todas las verificaciones sean reproducibles.

**Salida:** OB-09 completa con contratos de salida canónicos, enforcement transversal y evidencia sincronizada.

## Estrategia de pruebas

<!-- markdownlint-disable MD013 -->

| Nivel                 | Objetivo            | Evidencia principal                                                                          |
| --------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Unitario              | Response Schema     | Casos válidos, inválidos, transformaciones, ausencia, nullability y propiedades adicionales. |
| Unitario              | Interceptor         | Resolución de schema, valor transformado, passthrough y fallo reconocible sin filtraciones.  |
| Unitario              | Mapper              | Proyección pura desde resultado interno cuando exista transformación semántica.              |
| Unitario              | Error Boundary      | `ResponseContractViolation` se convierte en `500` seguro y diagnóstico permitido.            |
| Integración de módulo | Registro global     | Un único `APP_INTERCEPTOR` con dependencias resueltas por DI.                                |
| E2E                   | Contrato exitoso    | Health y fixture válido atraviesan el interceptor real y exponen solo campos públicos.       |
| E2E                   | Contrato incumplido | Response inválida produce Error Response correlacionado y logs seguros.                      |
| Regresión             | Pipeline HTTP       | Handlers sin schema, errores existentes, CORS, throttling, versioning y eventos terminales.  |

<!-- markdownlint-enable MD013 -->

Las pruebas unitarias de schemas y mappers no deben iniciar una aplicación NestJS. Las pruebas E2E no deben reemplazar
el interceptor, el filtro, el contexto ni el logger: deben recorrer el pipeline real. Los dobles solo podrán controlar
el resultado interno del fixture y la captura del backend de logging cuando sea necesario observar su salida.

## Comandos de verificación

Durante TDD deben ejecutarse primero las pruebas enfocadas de cada slice. Como mínimo:

```bash
pnpm exec vitest run src/modules/health/contracts
pnpm exec vitest run src/common/serialization
pnpm exec vitest run src/common/error-handling
pnpm test:e2e
```

Antes de iniciar la revisión RDD, se aplicará el flujo configurado de `lint-staged` al conjunto previsto hasta obtener
una segunda ejecución sin cambios. Después se ejecutará:

```bash
pnpm exec prettier --check .
pnpm lint
pnpm lint:md
pnpm test
pnpm test:e2e
pnpm build
```

Prettier debe ejecutarse con `--write` sobre cada Markdown editado antes de `markdownlint-cli2`. No debe utilizarse un
formateo global con escritura que modifique archivos ajenos al alcance.

## Riesgos y mitigaciones

<!-- markdownlint-disable MD013 -->

| Riesgo                                        | Mitigación                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Publicar modelos internos por accidente       | Exigir schema explícito y proyectar solo propiedades públicas.                                           |
| Duplicar el algoritmo de NestJS               | Extender el interceptor público únicamente en el punto de traducción del fallo.                          |
| Depender del mensaje `Serialization failed`   | Traducir por boundary a `ResponseContractViolation`, nunca por comparación de texto.                     |
| Filtrar issues o valores inválidos            | Construir una excepción sin payload y probar exclusiones en filtro, logs y HTTP.                         |
| Convertir un fallo interno en `4xx`           | Reservar siempre `500`, `INTERNAL_SERVER_ERROR` y sin `details`.                                         |
| Aplicar un schema global permisivo            | Declarar schema por handler o controller y no configurar un default general.                             |
| Rechazar extras internos sin necesidad        | Usar el schema como proyección pública y reservar el fallo para incumplimientos del contrato resultante. |
| Mantener schema y tipo duplicados             | Derivar el tipo desde el schema owner.                                                                   |
| Introducir lógica de negocio en mappers       | Mantenerlos puros y probarlos fuera de NestJS.                                                           |
| Alterar archivos o streams                    | Conservar el passthrough nativo y documentar excepciones explícitas.                                     |
| Romper respuestas de Terminus                 | Capturar primero el contrato público actual y triangular sus estados soportados.                         |
| Duplicar interceptores entre bootstraps       | Registrar un único `APP_INTERCEPTOR` mediante módulo importado por `AppModule`.                          |
| Confundir serialización con OpenAPI           | Mantener OB-07 fuera del alcance y reutilizar posteriormente los schemas canónicos.                      |
| Divergir entre documentación e implementación | Actualizar owners antes de APIs estables y cerrar el baseline solo después de verificar.                 |

<!-- markdownlint-enable MD013 -->

## Criterios de aceptación

- [ ] Existe un único interceptor global de Response serialization compartido por producción y E2E.
- [ ] El mecanismo reutiliza `StandardSchemaSerializerInterceptor` de NestJS 12.
- [ ] Cada Response JSON estructurada incluida declara un Response Schema canónico.
- [ ] Cada schema pertenece al Feature o contrato compartido que posee la Response.
- [ ] Los tipos de salida se derivan de sus schemas y no duplican manualmente el contrato.
- [ ] Las propiedades internas adicionales no aparecen en Responses públicas.
- [ ] Los modelos de persistencia e infraestructura no se convierten implícitamente en contratos.
- [ ] Los mappers existen solo ante transformaciones semánticas y permanecen puros.
- [ ] Handlers sin schema conservan su comportamiento hasta migrarse o documentarse como excepción.
- [ ] Archivos, streams y Responses especiales no se fuerzan mediante schemas de objeto.
- [ ] Todo fallo de schema produce una `ResponseContractViolation` sin payload sensible.
- [ ] Los fallos de salida devuelven `500`, `INTERNAL_SERVER_ERROR`, mensaje seguro y sin `details`.
- [ ] `body.requestId` coincide con `X-Request-Id` ante un fallo de salida.
- [ ] El diagnóstico inesperado contiene una clasificación estable y ningún valor rechazado.
- [ ] Se emite un único evento de fallo y un único evento terminal con status `500`.
- [ ] Health conserva sus rutas, status y contrato público mediante schemas explícitos.
- [ ] Los fixtures de fallo pertenecen solo al entorno E2E.
- [ ] La integración no altera Request validation, errores existentes, CORS, throttling ni versioning.
- [ ] Prettier, lint de TypeScript y Markdown, pruebas unitarias, E2E y build finalizan correctamente.
- [ ] Los documentos owner y ambas listas del baseline contienen evidencia sincronizada.

## Siguiente paso

Una vez completada OB-09, implementar **OB-08 — Request validation** si continúa pendiente, reutilizando los mismos
principios de ownership de schemas y el Error Boundary de OB-10. Con OB-08 y OB-09 completas, resolver **OB-07 —
Swagger/OpenAPI** desde los contratos canónicos sin duplicar su ownership.
