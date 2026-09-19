# Pruebas E2E

Status: Implemented

Este documento define la convención E2E implementada para verificar la API NestJS a través de HTTP.
Las convenciones generales de testing, determinismo y datos pertenecen a [testing.md](testing.md).

## Ejecución actual

Ejecute la suite E2E con:

```bash
pnpm run test:e2e
```

Vitest descubre exclusivamente `test/main.e2e-spec.ts` mediante `vitest.config.e2e.ts`. La
separación de ese descubrimiento respecto de `vitest.config.ts` queda diferida y no se modifica en
esta base.

El apagado de proceso no pertenece a esta suite HTTP: `pnpm run test:shutdown-process` construye y
ejecuta `test/shutdown/graceful-shutdown.process.test.ts` con su configuración POSIX aislada. El
owner de esa frontera de prueba es [testing.md](testing.md).

## Propietario y registro de suites

`test/main.e2e-spec.ts` es el único propietario del registro E2E. Registra las suites en un orden
explícito y les proporciona el ejecutor que crea, ejecuta y cierra una aplicación por escenario. El
harness concentra ese lifecycle y la agregación de errores de escenario y cleanup en una única
implementación; las suites no crean aplicaciones ni llaman helpers de lifecycle directamente. El
ownership de producción determina la ubicación de cada suite:

```text
src/modules/<feature> → test/modules/<feature>
src/common/<responsibility> → test/common/<responsibility>
```

`test/support` sigue siendo infraestructura compartida del harness E2E; no es un espejo de
`src/common`. El sufijo `*.e2e-suite.ts` no coincide con el punto de entrada descubierto. La suite
OpenAPI sigue el mismo registro y verifica los modos deshabilitado/habilitado, rutas configuradas,
metadata, exclusiones y headers observables. La suite exporta su función de registro y no declara
hooks globales ni administra aplicaciones, `process.env` o recursos compartidos. El propietario la
importa y registra de forma directa y revisable:

```typescript
registerHealthE2ESuite({ runScenario });
```

Una suite nueva debe seguir el mismo patrón; no se deben añadir propietarios E2E adicionales ni
arreglos dinámicos de registradores.

## Escenarios y bootstrap

Cada escenario independiente recibe una aplicación NestJS nueva y la cierra de forma determinista.
Por ello, los escenarios pueden reordenarse sin compartir estado. Los escenarios de límite de tasa
conservan sus solicitudes en la misma aplicación porque ese estado forma parte de su propio
contrato.

El bootstrap E2E usa componentes reales de la aplicación:

1. Compila `AppModule`.
2. Obtiene `ConfigType<typeof apiConfig>`, `ConfigType<typeof httpConfig>` y
   `ConfigType<typeof corsConfig>`, `ConfigType<typeof appConfig>` y
   `ConfigType<typeof openapiConfig>` mediante sus tokens.
3. Aplica `setupApplication` con los tres namespaces, inicializa la aplicación y la enlaza en
   `127.0.0.1` con un puerto efímero.
4. Aplica `setupOpenApi` después del bootstrap HTTP común y antes de inicializar la aplicación.
5. Usa Supertest sobre `app.getHttpServer()`.

El listener efímero de loopback permite solicitudes HTTP concurrentes sin exposición externa y
`app.close()` lo cierra tanto después de escenarios exitosos como después de fallos de bootstrap. El
helper no reproduce manualmente middleware de producción. Los componentes internos relevantes
permanecen reales. El módulo de pruebas añade `E2ERateLimitController` únicamente para verificar el
throttling global; ese controlador no forma parte de la aplicación de producción.

El ejecutor registrado acepta `E2EScenarioOptions` como segundo argumento. Los overrides del
bootstrap se declaran bajo `application` y conservan el tipo `CreateE2EApplicationOptions`; por
ejemplo, `runScenario(escenario, { application: { apiConfig } })`. Esta forma mantiene el callback
como primer argumento y permite añadir opciones de infraestructura por escenario sin entregar el
control del lifecycle a las suites.

`vitest.config.e2e.ts` define, mediante `test.env`, el baseline determinista completo del contrato
HTTP y una `DATABASE_URL` de configuración para PostgreSQL: `NODE_ENV=test`,
`API_GLOBAL_PREFIX=api`, `TRUST_PROXY_HOPS=0`, `CORS_ORIGINS=https://allowed.example`,
`CORS_MAX_AGE_SECONDS=600`, `THROTTLE_LIMIT=2`, `THROTTLE_TTL_SECONDS=60`, `OPENAPI_ENABLED=false`,
`OPENAPI_DOCS_ROUTE=docs` y `OPENAPI_DOCUMENT_ROUTE=openapi.json`. Estos valores fijan el entorno,
el prefijo, la confianza en proxies, CORS, throttling y OpenAPI para que el contrato no dependa de
valores del proceso invocador. Vitest los aplica dentro de la configuración E2E, incluso cuando el
proceso invocador aporta valores conflictivos. No se define `PORT`, porque el harness usa un puerto
efímero, ni configuración de shutdown, porque no participa en esta suite HTTP. El helper E2E no
modifica ni restaura `process.env`; las suites que necesitan otra configuración construyen valores
tipados con las factories y los inyectan mediante `overrideProvider(...KEY).useValue(...)` antes de
compilar; OpenAPI usa el baseline controlado para el escenario deshabilitado y overrides tipados de
`appConfig` u `openapiConfig` solo cuando un escenario requiere otra configuración.

## Contratos HTTP cubiertos

La suite de health conserva estos contratos públicos y transversales:

| Contrato                   | Resultado esperado                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health/live`  | `200` y respuesta básica de Terminus con `status: ok`; `info`, `error` y `details` vacíos.                                                                                               |
| `GET /api/v1/health/ready` | `200` con la misma respuesta inicial; readiness todavía no comprueba dependencias.                                                                                                       |
| Prefijo vacío              | Con `API_GLOBAL_PREFIX` vacío, `GET /v1/health/live` y `/v1/health/ready` responden `200`.                                                                                               |
| Rutas no publicadas        | `/health/*`, `/api/v2/health/live` y las rutas con el prefijo predeterminado en modo vacío responden `404`.                                                                              |
| Helmet                     | Ambos probes incluyen `x-content-type-options: nosniff` y `x-frame-options: SAMEORIGIN`.                                                                                                 |
| CORS                       | El origen permitido recibe `access-control-allow-origin`; el no configurado no la recibe.                                                                                                |
| Preflight                  | `OPTIONS /api/v1/health/live` desde el origen permitido responde `204`, declara métodos, headers, max age y `X-Request-Id`.                                                              |
| Correlación                | Todas las respuestas, incluidos `200`, `404`, `429` y preflight, devuelven `X-Request-Id`; UUIDv4 canónicos se adoptan y las solicitudes concurrentes permanecen aisladas.               |
| Throttling de health       | Las solicitudes repetidas a ambos probes continúan respondiendo `200` porque están excluidos del límite global.                                                                          |
| Throttling global          | La ruta exclusiva E2E versionada responde `200`, `200`, `429` con el límite configurado de dos solicitudes.                                                                              |
| Ruta raíz eliminada        | `GET /` responde `404`.                                                                                                                                                                  |
| OpenAPI deshabilitado      | `/docs`, `/openapi.json` y sus variantes con prefijo o versión responden `404`.                                                                                                          |
| OpenAPI habilitado         | Solo la UI y el JSON configurados responden `200`; el documento conserva rutas versionadas, metadata de `appConfig`, IDs estables y los schemas canónicos de health/error.               |
| Exclusión de OpenAPI       | El documento no incluye el catch-all ni controllers o fixtures exclusivos de E2E.                                                                                                        |
| JSON malformado            | `POST /api/v1/__test/validation` con JSON sintácticamente inválido responde `400` con el contrato público `BAD_REQUEST`, un `requestId` UUIDv4 correlacionado y sin detalles del parser. |

## Readiness draining diferido

`/health/ready` conserva su contrato inicial durante el apagado: no expone un estado de draining ni
responde `503`. La coordinación del cierre de proceso no modifica esa semántica; una capacidad de
draining requiere un contrato de deployment posterior.

## PostgreSQL y Prisma

La suite E2E usa PostgreSQL 16 y Prisma reales. `E2E_DATABASE_ADMIN_URL` debe referir únicamente a
la base de mantenimiento `postgres` de una instancia loopback. Antes de cada escenario, el harness
crea una base con nombre impredecible, aplica las migrations versionadas de
`src/database/prisma/migrations/` mediante `prisma migrate deploy` y construye el `AppModule` real
con su `databaseConfig` tipado. Al finalizar, cierra la aplicación —incluido el lifecycle de Prisma—
y elimina la base temporal con `DROP DATABASE ... WITH (FORCE)`.

El workflow CI provisiona PostgreSQL 16 y entrega esa URL administrativa. La ejecución local debe
proporcionar una instancia compatible; el harness rechaza URLs remotas o que no señalen `postgres`.
No se sustituyen Prisma ni Repositories en los flujos E2E.

## Extensiones futuras no implementadas

La base no implementa autenticación, fixtures, seeds, proveedores externos ni indicadores de salud
para dependencias.

Cuando exista una necesidad real, las siguientes pautas aplicarán:

- **Autenticación:** obtener credenciales mediante los flujos HTTP públicos de registro o inicio de
  sesión; no usar tokens preemitidos para omitir el comportamiento verificado.
- **Proveedores externos:** aislar únicamente el adaptador inyectado que cruza el límite fuera de
  proceso; controladores, guards, servicios, repositorios y persistencia permanecen reales.
- **Datos de prueba:** crear los prerrequisitos mediante HTTP cuando sea razonable. Un seed directo
  solo podrá crear un prerrequisito mínimo y justificado que no deba producirse mediante la API.

No se deben introducir interfaces vacías, adaptadores falsos, infraestructura simulada ni
abstracciones prematuras antes de que una capacidad concreta las requiera.
