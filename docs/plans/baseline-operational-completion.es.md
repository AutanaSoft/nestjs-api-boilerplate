# Lista de verificación para completar la base operativa

Esta lista registra el trabajo operativo que debe completarse antes de iniciar el desarrollo de
módulos de negocio. Es una herramienta de seguimiento, no un documento arquitectónico responsable:
siga los documentos de referencia enlazados para las reglas y los contratos. Swagger/OpenAPI es
obligatorio antes de iniciar el desarrollo de módulos de negocio.

English version: [Operational baseline completion checklist](baseline-operational-completion.md).

## Alcance y estado

**Incluido:** la base operativa HTTP y su verificación. **Excluido:** base de datos, autenticación,
autorización y módulos de negocio. Las métricas y las trazas se difieren deliberadamente; esta base
**no** representa observabilidad completa.

| Estado       | Significado                                                              |
| ------------ | ------------------------------------------------------------------------ |
| Completo     | Existe implementación y evidencia verificadas.                           |
| Pendiente    | Debe implementarse antes de iniciar el desarrollo de módulos de negocio. |
| Sin resolver | Permanece abierta una decisión de implementación obligatoria.            |
| Diferido     | Está intencionalmente fuera del denominador de completitud de esta base. |

### Resumen de estado de tareas

**Denominador de completitud: OB-01 a OB-13.** OB-14 está explícitamente diferido y no cuenta para
que la base esté lista.

- [x] OB-01 — Completo
- [x] OB-02 — Completo
- [x] OB-03 — Completo
- [x] OB-04 — Completo
- [x] OB-05 — Completo
- [x] OB-06 — Completo
- [ ] OB-07 — Pendiente
- [ ] OB-08 — Pendiente
- [ ] OB-09 — Pendiente
- [ ] OB-10 — Pendiente
- [ ] OB-11 — Pendiente
- [ ] OB-12 — Pendiente
- [ ] OB-13 — Sin resolver
- [ ] OB-14 — Diferido; fuera del denominador de completitud

## Límite de evidencia

### APIs de implementación verificadas y utilizables

- `setupApplication()` configura proxy confiable, prefijo global opcional, versionado URI, Helmet y
  CORS (`src/app.setup.ts`).
- `HealthController` expone `GET /health/live` y `GET /health/ready` versionados; las rutas
  publicadas predeterminadas son `/api/v1/health/live` y `/api/v1/health/ready`
  (`src/modules/health/health.controller.ts`,
  [documento de referencia de versionado](../api/versioning.md)).
- Factories de configuración Zod tipadas y registradas con `registerAs` proporcionan `app`, `api`,
  `http`, `cors` y `rateLimit` (`src/config/`;
  [documento de referencia de configuración](../architecture/configuration.md)).

### Objetivos documentados, no APIs utilizables verificadas

`StandardSchemaValidationPipe` y `StandardSchemaSerializerInterceptor` son nombres de estrategia
objetivo en los documentos arquitectónicos, no exportaciones del código fuente ni APIs de ejecución
instaladas verificadas. Del mismo modo, el documento de referencia de OpenAPI exige
`@nestjs/swagger`, pero no está presente en `package.json` y no hay inicialización de Swagger
verificada. No considere esos nombres como APIs listas para implementar.

## Lista de completitud

### Base implementada

| ID    | Estado   | Elemento, evidencia, dependencias y criterios de aceptación                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-01 | Completo | **Configuración Zod tipada.** Evidencia: `src/config/*.config.ts` valida y registra espacios de nombres tipados; `AppModule` los carga. Dependencias: ninguna. Aceptación: la configuración se valida antes de que los consumidores reciban valores tipados; los valores requeridos inválidos detienen el inicio. Documento de referencia: [configuración](../architecture/configuration.md).                                    |
| OB-02 | Completo | **Base de seguridad HTTP y proxy.** Evidencia: `setupApplication()` configura `trust proxy`, Helmet y CORS explícito; E2E cubre cabeceras, orígenes y preflight. Dependencias: OB-01. Aceptación: los saltos de proxy, Helmet y CORS continúan configurados mediante la inicialización compartida entre producción y E2E. Documento de referencia: [seguridad HTTP](../configuration/http-security.md).                          |
| OB-03 | Completo | **Versionado URI.** Evidencia: `API_VERSION = '1'`, `setupApplication()` habilita `VersioningType.URI` y `HealthController` declara la versión. Dependencias: OB-01. Aceptación: las rutas publicadas usan el prefijo configurado más `/v1`; las rutas de health sin versión o con una versión inexistente continúan inaccesibles. Documento de referencia: [versionado de API](../api/versioning.md).                           |
| OB-04 | Completo | **Limitación global en memoria.** Evidencia: `ThrottlerModule.forRootAsync()` usa `rateLimitConfig`; health está excluido y E2E verifica `200`, `200`, `429` en la ruta exclusiva E2E. Dependencias: OB-01. Aceptación: los límites se validan al inicio y las rutas fuera de health están protegidas. Limitación: los contadores son por proceso. Documento de referencia: [seguridad HTTP](../configuration/http-security.md). |
| OB-05 | Completo | **Comprobaciones de salud.** Evidencia: `HealthModule` y `HealthController` usan Terminus; E2E afirma ambos probes versionados. Dependencias: OB-02, OB-03, OB-04. Aceptación: liveness y readiness devuelven la respuesta básica de Terminus documentada y todavía no comprueban dependencias. Documento de referencia: [pruebas E2E](../testing/e2e-testing.md).                                                               |
| OB-06 | Completo | **Calidad y CI.** Evidencia: `.github/workflows/ci.yml` ejecuta instalación congelada, formato, análisis estático de TypeScript/Markdown, pruebas unitarias y E2E, y compilación en pull requests y pushes a `main`. Dependencias: archivo de bloqueo y herramientas. Aceptación: CI continúa ejecutando esa secuencia. Documento de referencia: [pruebas](../testing/testing.md).                                               |

### Debe completarse antes de iniciar el desarrollo de módulos de negocio

| ID    | Estado       | Elemento, evidencia, dependencias y criterios de aceptación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-07 | Pendiente    | **Swagger/OpenAPI (obligatorio).** Evidencia: el [documento de referencia de OpenAPI](../api/openapi.md) declara requisitos de `@nestjs/swagger` y `operationId` estable y único; no existe el paquete ni la inicialización. Dependencias: OB-03 y contratos canónicos de petición/respuesta/error. Aceptación: generar OpenAPI desde esquemas/contratos canónicos; incluir cada ruta versionada publicada; conservar operation IDs únicos y estables; representar errores compartidos; añadir comprobaciones contractuales. **Decisiones de implementación sin resolver:** política de exposición en producción, rutas de documentación/especificación, fuente y valores de metadatos, y cómo se alinean los metadatos del generador con contratos Zod canónicos. No se eligen aquí. |
| OB-08 | Pendiente    | **Validación de peticiones.** Evidencia: la arquitectura nombra `StandardSchemaValidationPipe` como objetivo; no hay implementación verificada. Dependencias: esquemas canónicos de petición y traducción de errores OB-10. Aceptación: validar y normalizar la entrada externa antes de que los controladores o servicios la reciban, usando esquemas canónicos; traducir fallos de validación al contrato de error público compartido. Documento de referencia: [validación](../architecture/validation.md).                                                                                                                                                                                                                                                                        |
| OB-09 | Pendiente    | **Serialización de respuestas.** Evidencia: la arquitectura nombra `StandardSchemaSerializerInterceptor` como objetivo; no hay implementación verificada. Dependencias: esquemas canónicos de respuesta y OB-10. Aceptación: validar/serializar respuestas públicas contra sus esquemas canónicos sin exponer modelos internos. Documento de referencia: [serialización](../architecture/serialization.md).                                                                                                                                                                                                                                                                                                                                                                           |
| OB-10 | Pendiente    | **Errores HTTP centrales.** Evidencia: la arquitectura exige un límite de errores global y el contrato compartido `{ statusCode, code, message, requestId, details? }`; no se verifica un filtro. Dependencias: OB-11 para `requestId`. Aceptación: un único límite traduce errores de validación, esperados y desconocidos en respuestas seguras y documentadas sin detalles técnicos ni sensibles. Documentos de referencia: [manejo de errores](../architecture/error-handling.md), [contratos HTTP](../api/http-contracts.md).                                                                                                                                                                                                                                                    |
| OB-11 | Pendiente    | **Correlación de peticiones y logs estructurados.** Evidencia: el documento de referencia de observabilidad requiere un `requestId` propagado y logs estructurados no sensibles; no hay implementación verificada. Dependencias: ninguna; OB-10 consume su información de correlación. Aceptación: cada petición recibe o adopta de forma segura un ID de correlación, registra eventos estructurados estables con él y lo devuelve solo donde el contrato público lo exige. Documento de referencia: [observabilidad](../architecture/observability.md).                                                                                                                                                                                                                             |
| OB-12 | Pendiente    | **Apagado ordenado.** Evidencia: `src/main.ts` crea y escucha, pero no se verifica manejo de apagado. Dependencias: semántica de health y futuros responsables de recursos. Aceptación: la terminación deja de aceptar trabajo, cierra Nest/recursos dentro de una política acotada y sale con un resultado observable; añadir pruebas enfocadas cuando sea práctico.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OB-13 | Sin resolver | **Versión reproducible de pnpm.** Evidencia: README indica pnpm `11.25.0`, pero `package.json` no tiene `packageManager`; el pnpm local histórico fue `12.4.1`. Dependencias: política del gestor de paquetes y CI/Corepack. Aceptación: registrar una versión canónica de pnpm en el mecanismo de repositorio seleccionado por los responsables, alinear README y comportamiento CI/Corepack y verificar la instalación congelada. **Decisión abierta:** versión canónica de pnpm y mecanismo de declaración. No se elige ninguno en esta lista.                                                                                                                                                                                                                                     |

### Diferido explícitamente

| ID    | Estado   | Elemento, evidencia, dependencias y criterios de aceptación                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-14 | Diferido | **Métricas y trazas.** Evidencia: el documento de referencia de observabilidad aprueba OpenTelemetry para métricas y trazas, pero no hay implementación verificada. Dependencias: backend operativo y diseño de instrumentación. Aceptación para eliminar este diferimiento: definir métricas estables de baja cardinalidad y propagación/instrumentación de trazas, y verificarlas. Esto no marca la observabilidad completa. Documento de referencia: [observabilidad](../architecture/observability.md). |

## Criterios finales de completitud de la base

La base está lista **antes de iniciar el desarrollo de módulos de negocio** solo cuando:

- [ ] Todos los elementos de OB-01 a OB-13 están Completos y tienen evidencia actual de
      implementación.
- [ ] Todas las decisiones de implementación sin resolver, incluidas la exposición, rutas y
      metadatos de Swagger/OpenAPI y la versión/declaración canónica de pnpm, están resueltas y
      reflejadas en los documentos de referencia pertinentes.
- [ ] Las comprobaciones enfocadas y de calidad del repositorio requeridas se ejecutan nuevamente y
      finalizan correctamente después de los cambios finales.
- [ ] OB-14 permanece explícitamente diferido y excluido del denominador de completitud, salvo que
      su alcance sea aprobado e implementado por separado.

## Verificación previa (no ejecución nueva)

Lo siguiente se informó antes en esta sesión y no se ejecutó de nuevo para este documento: Prettier
check, lint, Markdown lint, 63 pruebas unitarias, 14 pruebas E2E y build finalizaron correctamente.
El entorno informado fue Node `26.8.2` y pnpm `12.4.1`; la advertencia informada fue
`vite-tsconfig-paths`. README declara pnpm `11.25.0`, mientras que `package.json` no tiene un campo
`packageManager`.

## Mantenimiento

- Mantenga idénticos los IDs y estados de los elementos en la
  [versión en inglés](baseline-operational-completion.md).
- Actualice evidencia únicamente desde código fuente, pruebas, CI o documentos de referencia
  verificados; no convierta objetivos en APIs completadas sin evidencia de implementación.
- Cambie el estado de un elemento, su casilla de tarea, evidencia, dependencias y criterios de
  aceptación en ambas traducciones dentro del mismo cambio.
- Mantenga OB-14 fuera del denominador de completitud salvo que un alcance aprobado por separado lo
  cambie.
- Enlace los documentos de referencia en lugar de duplicar sus reglas arquitectónicas o de contrato
  público.
