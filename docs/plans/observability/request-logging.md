# Plan de implementación de correlación de solicitudes y logs estructurados

Este plan define cómo completar **OB-11** mediante un contexto de solicitud con `requestId` y logs estructurados, sin
incorporar todavía la traducción central de errores de OB-10 ni las métricas y trazas diferidas en OB-14.

## Resultado esperado

Al finalizar, cada solicitud HTTP deberá disponer de un `requestId` durante todo su ciclo de vida. Los eventos HTTP
deberán emitirse con mensajes estables, campos estructurados y sin datos sensibles. La misma configuración deberá
utilizarse en producción y en las pruebas E2E.

## Alcance

### Incluido

- Crear y propagar un `requestId` por solicitud.
- Adoptar de forma segura un identificador recibido cuando cumpla la política acordada.
- Devolver el identificador mediante el header público acordado.
- Mantener el contexto de correlación sin acoplar los servicios de aplicación a Express.
- Emitir un evento estructurado al completar cada solicitud.
- Integrar el contexto de correlación con el logger de NestJS.
- Cubrir generación, adopción, aislamiento, propagación y logging mediante pruebas unitarias y E2E.
- Actualizar la documentación owner y la evidencia del baseline.

### Fuera de alcance

- El Error Boundary y el contrato JSON de errores, pertenecientes a OB-10.
- Request validation y response serialization, pertenecientes a OB-08 y OB-09.
- Métricas, trazas y exportadores de OpenTelemetry, diferidos en OB-14.
- Logging específico de módulos de negocio todavía inexistentes.
- Persistencia o propagación distribuida del `requestId` hacia dependencias externas.

## Dependencias y documentos owner

La implementación debe respetar los siguientes documentos:

- [Observabilidad](../../architecture/observability.md): correlación, mensajes estables, estructura y protección de
  datos sensibles.
- [Contratos HTTP](../../api/http-contracts.md): uso público de `requestId`, especialmente en el futuro contrato de
  error.
- [Manejo de errores](../../architecture/error-handling.md): integración posterior de OB-10 con el contexto de
  correlación.
- [Seguridad HTTP](../../configuration/http-security.md): política CORS cuando el identificador se exponga como header.
- [Pruebas](../../testing/testing.md) y [pruebas E2E](../../testing/e2e-testing.md): niveles y estrategia de
  verificación.

## Decisiones requeridas antes de implementar

Estas decisiones deben registrarse en el documento owner correspondiente antes de consolidar la API interna. No deben
quedar implícitas en el middleware o en las pruebas.

<!-- markdownlint-disable MD013 -->

| Decisión                    | Decisión adoptada                                                                                                             | Criterio                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Header público              | **Resuelta:** usar `X-Request-Id` para entrada y salida                                                                       | Es reconocible, interoperable y permite correlacionar solicitudes desde clientes y proxies.                               |
| Adopción del valor entrante | **Resuelta:** aceptar únicamente UUID v4 en representación textual canónica de 36 caracteres; reemplazar cualquier otro valor | Evita inyección en logs, abuso de memoria y valores ambiguos.                                                             |
| Generación                  | **Resuelta:** generar UUID v4 mediante `node:crypto` y `randomUUID()`                                                         | No requiere dependencias adicionales, no contiene datos del cliente y no depende de infraestructura externa.              |
| Contexto asíncrono          | **Resuelta:** encapsular `AsyncLocalStorage` detrás de `RequestContextService`                                                | Evita propagar objetos Express y mantiene una frontera reemplazable.                                                      |
| Backend de logging          | **Resuelta:** usar `ConsoleLogger` con `json: true` y `colors: true` detrás de `ApplicationLogger` y `APP_LOGGER`             | Evita dependencias adicionales, conserva colores y permite sustituir la implementación por Pino sin cambiar consumidores. |
| Evento HTTP inicial         | **Resuelta:** emitir un único evento terminal `http.request.completed` por solicitud                                          | Reduce ruido, evita duplicados y ofrece una base estable para diagnóstico.                                                |
| Ruta registrada             | **Resuelta:** usar la plantilla de ruta normalizada y no registrar valores concretos ni query strings                         | Evita datos sensibles y cardinalidad no controlada.                                                                       |

<!-- markdownlint-enable MD013 -->

## Diseño propuesto

### Estructura de archivos

Los nombres de archivos, carpetas, símbolos y eventos se mantienen en inglés.

```text
src/common/observability/
├── constants.ts
├── observability.module.ts
├── context/
│   ├── request-context.service.ts
│   └── request-context.service.spec.ts
├── logging/
│   ├── application-logger.ts
│   ├── logger.service.ts
│   └── logger.service.spec.ts
└── middleware/
    ├── correlation.middleware.ts
    ├── correlation.middleware.spec.ts
    ├── request-logging.middleware.ts
    └── request-logging.middleware.spec.ts
```

Archivos existentes que previsiblemente deberán modificarse:

```text
src/app.module.ts
src/app.setup.ts
src/app.setup.spec.ts
src/config/cors.config.ts
test/modules/health/health.e2e-suite.ts
docs/architecture/observability.md
docs/configuration/http-security.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

La lista es una previsión de alcance. Si durante la implementación se requiere otro archivo, deberá justificarse antes
de ampliar el cambio.

### Responsabilidades

#### `RequestContextService`

- Encapsular el almacenamiento asíncrono.
- Iniciar un contexto independiente para cada solicitud.
- Exponer el `requestId` actual sin exponer `Request` ni `Response`.
- Retornar una ausencia explícita fuera de un contexto HTTP, para permitir procesos futuros no HTTP.

#### `RequestCorrelationMiddleware`

- Leer el header de correlación acordado.
- Validar que el valor sea un UUID v4 canónico de 36 caracteres antes de adoptarlo.
- Generar un UUID v4 mediante `node:crypto` y `randomUUID()` cuando falte o sea inválido.
- Iniciar el contexto antes de continuar el pipeline.
- Añadir el identificador al header de respuesta.
- No registrar por sí mismo el body, query, credenciales ni headers sensibles.

#### `ApplicationLogger` y `APP_LOGGER`

- Definir un contrato propio y mínimo para niveles y metadatos estructurados.
- Proveer un token de inyección estable `APP_LOGGER` desde `constants.ts`.
- Impedir que los consumidores dependan directamente de `ConsoleLogger` o de una integración futura con Pino.
- Mantener reutilizables las pruebas de contrato para cualquier implementación del logger.

#### `StructuredLoggerService`

- Implementar `ApplicationLogger` adaptando `ConsoleLogger` de NestJS con `json: true` y `colors: true`.
- Documentar que los códigos ANSI impiden considerar la salida como JSON estricto.
- Adjuntar automáticamente el `requestId` cuando exista.
- Recibir mensajes estables y contexto como campos separados.
- Mantener una lista explícita de campos permitidos para eventos HTTP.
- No interpolar payloads arbitrarios ni información sensible en el mensaje.

#### `HttpRequestLoggingMiddleware`

- Medir la duración monotónica de la solicitud.
- Emitir exactamente un evento `http.request.completed` al terminar la respuesta.
- Incluir como mínimo `requestId`, método, ruta normalizada, status code y duración.
- Cubrir respuestas exitosas y fallidas sin asumir la forma final del Error Response de OB-10.
- Evitar bodies, query strings, tokens, cookies y valores completos de headers.

#### `ObservabilityModule`

- Registrar y exportar únicamente los providers transversales necesarios.
- Registrar los middlewares de correlación y logging terminal antes de CORS en el bootstrap compartido.
- Mantener la infraestructura de observabilidad separada de los módulos de negocio.

## Secuencia de implementación

La ejecución seguirá ciclos RED, GREEN, TRIANGULATE y REFACTOR. Cada fase debe mantener las pruebas anteriores en verde.

### Fase 1 — Formalizar contratos

1. Resolver las decisiones de header, formato, longitud, generación y backend de logging.
2. Documentar esas decisiones en `docs/architecture/observability.md`.
3. Actualizar `docs/configuration/http-security.md` si el header forma parte de CORS.
4. Definir constantes compartidas para el nombre del header, límites y nombres de eventos.

**Salida:** reglas verificables antes de escribir la infraestructura.

### Fase 2 — Crear el contexto de solicitud

1. Escribir pruebas unitarias fallidas para creación, lectura, ausencia e independencia del contexto.
2. Implementar `RequestContextService` con una API mínima.
3. Triangular con solicitudes concurrentes para detectar contaminación entre contextos.
4. Refactorizar sin exponer detalles de `AsyncLocalStorage` a consumidores.

**Salida:** contexto aislado y reutilizable que contiene `requestId`.

### Fase 3 — Incorporar correlación al pipeline HTTP

1. Escribir pruebas fallidas para generación, adopción válida, reemplazo de valores inválidos y header de respuesta.
2. Implementar `RequestCorrelationMiddleware`.
3. Registrarlo suficientemente temprano para que guards, interceptors y controllers compartan el mismo contexto.
4. Ajustar CORS para permitir y exponer el header únicamente si así lo establece el contrato aprobado.
5. Ampliar `src/app.setup.spec.ts` para verificar la configuración compartida.

**Salida:** toda solicitud HTTP entra al pipeline con un identificador seguro.

### Fase 4 — Añadir logging estructurado

1. Escribir pruebas fallidas para mensajes estables, campos estructurados e inclusión automática de `requestId`.
2. Implementar `StructuredLoggerService` sobre `ConsoleLogger` con `json: true` y `colors: true`.
3. Escribir pruebas fallidas para el evento terminal HTTP, incluyendo éxito y fallo.
4. Implementar y registrar `HttpRequestLoggingMiddleware` antes de CORS.
5. Verificar que el evento no incluya query strings, bodies, cookies, authorization headers ni stack traces.

**Salida:** un evento estructurado y correlacionado por solicitud completada.

### Fase 5 — Verificar el contrato por HTTP

Extender la suite E2E existente para demostrar que:

1. una solicitud sin header recibe un `requestId` generado;
2. un identificador válido puede adoptarse y devolverse;
3. un identificador inválido se reemplaza;
4. solicitudes independientes reciben identificadores distintos;
5. solicitudes concurrentes no intercambian sus identificadores;
6. las respuestas `200`, `404` y `429` contienen el header de correlación;
7. el preflight CORS declara el header cuando corresponda;
8. el evento terminal contiene los campos acordados y no expone datos sensibles.

La forma JSON uniforme de los errores no se comprobará aquí: será responsabilidad de OB-10, que consumirá
`RequestContextService` para completar `ErrorResponse.requestId`.

### Fase 6 — Cerrar evidencia y documentación

1. Ejecutar las comprobaciones enfocadas durante cada ciclo TDD.
2. Ejecutar la verificación completa del repositorio.
3. Actualizar ambas versiones de `baseline-operational-completion` con el mismo estado y evidencia.
4. Marcar OB-11 como completa solo si la implementación y todas las comprobaciones son reproducibles.
5. Registrar explícitamente que OB-10 queda como siguiente tarea desbloqueada.

## Estrategia de pruebas

<!-- markdownlint-disable MD013 -->

| Nivel    | Objetivo                                  | Evidencia principal                                                               |
| -------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Unitario | Validación y generación del identificador | Casos válidos, inválidos, ausentes y límites.                                     |
| Unitario | Aislamiento del contexto                  | Contextos concurrentes y acceso fuera de solicitud.                               |
| Unitario | Adaptación del logger                     | Mensajes estables, campos estructurados y correlación automática.                 |
| Unitario | Evento terminal HTTP                      | Éxito, fallo, duración y exclusión de datos sensibles.                            |
| Setup    | Registro global y CORS                    | Orden del pipeline y configuración del header.                                    |
| E2E      | Comportamiento HTTP real                  | Generación, adopción, propagación, concurrencia, `200`, `404`, `429` y preflight. |

<!-- markdownlint-enable MD013 -->

Las pruebas de tiempo no deben depender de esperas reales: la fuente monotónica deberá poder controlarse o comprobarse
sin afirmar duraciones exactas.

## Comandos de verificación

La implementación deberá identificar primero los archivos afectados y ejecutar el flujo configurado de `lint-staged`
sobre ese conjunto hasta que una segunda ejecución no produzca cambios. Después se ejecutará, como mínimo:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm lint:md
pnpm build
```

También se ejecutará Prettier sobre los Markdown editados antes de `markdownlint-cli2`, conforme a las reglas del
repositorio.

## Riesgos y mitigaciones

<!-- markdownlint-disable MD013 -->

| Riesgo                                                   | Mitigación                                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Confiar en contenido arbitrario enviado como `requestId` | Validar y limitar el valor; reemplazarlo cuando no cumpla el contrato.                                                                   |
| Filtrar secretos o datos personales en logs              | Usar campos permitidos y prohibir bodies, query strings y headers sensibles.                                                             |
| Perder contexto en operaciones asíncronas                | Probar concurrencia y encapsular correctamente el ciclo de `AsyncLocalStorage`.                                                          |
| Emitir más de un evento terminal                         | Centralizarlo en un único middleware terminal y probar éxito y fallo.                                                                    |
| Romper CORS                                              | Actualizar pruebas unitarias y E2E de preflight junto con la configuración.                                                              |
| Acoplar OB-11 con OB-10                                  | Limitar OB-11 al contexto, header y logs; dejar el contrato JSON de errores para OB-10.                                                  |
| Esperar JSON estricto con colores ANSI                   | Documentar y probar que esta configuración produce una representación estructurada mediante `inspect()`, no JSON directamente parseable. |
| Generar rutas de alta cardinalidad                       | Preferir plantillas normalizadas y omitir query strings.                                                                                 |

<!-- markdownlint-enable MD013 -->

## Criterios de aceptación

- [ ] Cada solicitud dispone de un `requestId` durante todo su ciclo de vida.
- [ ] Los valores externos solo se adoptan cuando cumplen la política documentada.
- [ ] El identificador se devuelve mediante el header público acordado.
- [ ] El contexto permanece aislado entre solicitudes concurrentes.
- [ ] Controllers y servicios no necesitan recibir objetos Express para acceder a la correlación.
- [ ] Cada solicitud genera un evento terminal con mensaje y campos estables mediante `ConsoleLogger` configurado con
      `json: true` y `colors: true`.
- [ ] Los consumidores dependen de `ApplicationLogger` y `APP_LOGGER`, no directamente de `ConsoleLogger`.
- [ ] La documentación y las pruebas no presentan la salida coloreada como JSON estricto directamente parseable.
- [ ] Los eventos no contienen secretos, credenciales, payloads completos ni query strings.
- [ ] Las pruebas cubren respuestas `200`, `404` y `429`, además de CORS cuando corresponda.
- [ ] Producción y E2E utilizan el mismo registro transversal.
- [ ] Prettier, lint de TypeScript y Markdown, pruebas unitarias, E2E y build finalizan correctamente.
- [ ] Los documentos owner y ambas listas de baseline contienen evidencia sincronizada.

## Siguiente paso

Una vez completada OB-11, implementar **OB-10 — Central HTTP errors** reutilizando `RequestContextService` para poblar
`ErrorResponse.requestId` y correlacionar el diagnóstico interno sin exponer detalles técnicos al cliente.
