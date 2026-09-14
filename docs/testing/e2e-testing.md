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

## Propietario y registro de suites

`test/main.e2e-spec.ts` es el único propietario del registro E2E. Registra las suites en un orden
explícito y les proporciona el ejecutor que crea y cierra una aplicación por escenario. Una suite de
funcionalidad se ubica en:

```text
test/modules/<feature>/<feature>.e2e-suite.ts
```

El sufijo `*.e2e-suite.ts` no coincide con el punto de entrada descubierto. La suite OpenAPI sigue
el mismo registro y verifica los modos deshabilitado/habilitado, rutas configuradas, metadata,
exclusiones y headers observables. La suite exporta su función de registro y no declara hooks
globales ni administra aplicaciones, `process.env` o recursos compartidos. El propietario la importa
y registra de forma directa y revisable:

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

`vitest.config.e2e.ts` define, mediante `test.env`, los valores E2E de
`CORS_ORIGINS=https://allowed.example`, `CORS_MAX_AGE_SECONDS=600`, `THROTTLE_LIMIT=2` y
`THROTTLE_TTL_SECONDS=60`. El helper E2E no lee, modifica ni restaura `process.env`; Vitest aplica
esos valores dentro de la configuración E2E, incluso cuando el proceso invocador aporta valores
conflictivos. Las suites que necesitan otra configuración construyen valores tipados con las
factories y los inyectan mediante `overrideProvider(...KEY).useValue(...)` antes de compilar;
OpenAPI usa overrides tipados de `appConfig` y `openapiConfig`.

## Contratos HTTP cubiertos

La suite de health conserva estos contratos públicos y transversales:

| Contrato                   | Resultado esperado                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health/live`  | `200` y respuesta básica de Terminus con `status: ok`; `info`, `error` y `details` vacíos.                                                                                 |
| `GET /api/v1/health/ready` | `200` con la misma respuesta inicial; readiness todavía no comprueba dependencias.                                                                                         |
| Prefijo vacío              | Con `API_GLOBAL_PREFIX` vacío, `GET /v1/health/live` y `/v1/health/ready` responden `200`.                                                                                 |
| Rutas no publicadas        | `/health/*`, `/api/v2/health/live` y las rutas con el prefijo predeterminado en modo vacío responden `404`.                                                                |
| Helmet                     | Ambos probes incluyen `x-content-type-options: nosniff` y `x-frame-options: SAMEORIGIN`.                                                                                   |
| CORS                       | El origen permitido recibe `access-control-allow-origin`; el no configurado no la recibe.                                                                                  |
| Preflight                  | `OPTIONS /api/v1/health/live` desde el origen permitido responde `204`, declara métodos, headers, max age y `X-Request-Id`.                                                |
| Correlación                | Todas las respuestas, incluidos `200`, `404`, `429` y preflight, devuelven `X-Request-Id`; UUIDv4 canónicos se adoptan y las solicitudes concurrentes permanecen aisladas. |
| Throttling de health       | Las solicitudes repetidas a ambos probes continúan respondiendo `200` porque están excluidos del límite global.                                                            |
| Throttling global          | La ruta exclusiva E2E versionada responde `200`, `200`, `429` con el límite configurado de dos solicitudes.                                                                |
| Ruta raíz eliminada        | `GET /` responde `404`.                                                                                                                                                    |
| OpenAPI deshabilitado      | `/docs`, `/openapi.json` y sus variantes con prefijo o versión responden `404`.                                                                                            |
| OpenAPI habilitado         | Solo la UI y el JSON configurados responden `200`; el documento conserva rutas versionadas, metadata de `appConfig`, IDs estables y los schemas canónicos de health/error. |
| Exclusión de OpenAPI       | El documento no incluye el catch-all ni controllers o fixtures exclusivos de E2E.                                                                                          |

## Extensiones futuras no implementadas

La base entregada no implementa PostgreSQL, Prisma, migraciones, autenticación, fixtures, seeds,
proveedores externos, indicadores de salud para dependencias ni abstracciones para esas capacidades.

Cuando exista una necesidad real, las siguientes pautas aplicarán:

- **PostgreSQL y Prisma:** usar una base temporal aislada, validar su configuración administrativa,
  aplicar migraciones versionadas y eliminar los recursos al finalizar.
- **Autenticación:** obtener credenciales mediante los flujos HTTP públicos de registro o inicio de
  sesión; no usar tokens preemitidos para omitir el comportamiento verificado.
- **Proveedores externos:** aislar únicamente el adaptador inyectado que cruza el límite fuera de
  proceso; controladores, guards, servicios, repositorios y persistencia permanecen reales.
- **Datos de prueba:** crear los prerrequisitos mediante HTTP cuando sea razonable. Un seed directo
  solo podrá crear un prerrequisito mínimo y justificado que no deba producirse mediante la API.

No se deben introducir interfaces vacías, adaptadores falsos, infraestructura simulada ni
abstracciones prematuras antes de que una capacidad concreta las requiera.

## Rollback

El rollback de esta unidad revierte solo esta documentación y los metadatos E2E de
`openspec/config.yaml`. La identificación de Vitest se conserva mientras siga siendo el ejecutor
real; una regresión de la organización de pruebas no justifica declarar Playwright como framework
E2E.
