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

`test/main.e2e-spec.ts` es el único propietario del ciclo de vida E2E. Prepara el entorno, registra
las suites en un orden explícito y libera sus recursos al terminar. Una suite de funcionalidad se
ubica en:

```text
test/modules/<feature>/<feature>.e2e-suite.ts
```

El sufijo `*.e2e-suite.ts` no coincide con el punto de entrada descubierto. La suite exporta su
función de registro y no declara hooks globales ni administra aplicaciones, `process.env` o recursos
compartidos. El propietario la importa y registra de forma directa y revisable:

```typescript
registerAppE2ESuite({ runScenario });
```

Una suite nueva debe seguir el mismo patrón; no se deben añadir propietarios E2E adicionales ni
arreglos dinámicos de registradores.

## Escenarios y bootstrap

Cada escenario independiente recibe una aplicación NestJS nueva y la cierra de forma determinista.
Por ello, los escenarios pueden reordenarse sin compartir estado. El escenario de límite de tasa
conserva sus tres solicitudes en la misma aplicación porque ese estado forma parte de su propio
contrato.

El bootstrap E2E usa componentes reales de la aplicación:

1. Compila `AppModule`.
2. Obtiene `ConfigType<typeof httpConfig>` mediante `httpConfig.KEY`.
3. Aplica `setupApplication` e inicializa la aplicación.
4. Usa Supertest sobre `app.getHttpServer()`.

No inicia un puerto con `listen` ni reproduce manualmente middleware de producción. Los componentes
internos relevantes permanecen reales.

El entorno E2E solo captura, modifica y restaura `CORS_ORIGINS`, `THROTTLE_LIMIT` y
`THROTTLE_TTL_SECONDS`. Conserva tanto la presencia como el valor previo de cada variable y los
restaura tras el desmontaje normal o una preparación parcial fallida. No modifica otras claves del
entorno.

## Contratos HTTP cubiertos

La suite de aplicación conserva estos cuatro contratos públicos:

| Contrato       | Resultado esperado                                                                        |
| -------------- | ----------------------------------------------------------------------------------------- |
| `GET /`        | `200`, `Hello World!`, `x-content-type-options: nosniff` y `x-frame-options: SAMEORIGIN`. |
| CORS           | El origen permitido recibe `access-control-allow-origin`; el no configurado no la recibe. |
| Preflight      | `OPTIONS /` desde el origen permitido responde `204` y conserva la cabecera CORS.         |
| Límite de tasa | Con límite dos, tres solicitudes `GET /` responden `200`, `200`, `429`.                   |

## Extensiones futuras no implementadas

La base entregada no implementa PostgreSQL, Prisma, migraciones, autenticación, fixtures, seeds,
proveedores externos, dependencias nuevas ni abstracciones para esas capacidades.

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
