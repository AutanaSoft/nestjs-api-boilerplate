# Implementación del versionado HTTP

Este plan introduce URI Versioning nativo de NestJS. De forma predeterminada, el contrato HTTP se
publicará bajo `/api/v1`; los despliegues con un subdominio dedicado podrán omitir el prefijo y usar
`/v1`. El cambio centraliza la configuración en el bootstrap compartido por producción y E2E, migra
las rutas actuales y conserva las responsabilidades documentales existentes.

## Resultado esperado

Con la configuración predeterminada, la primera versión pública utilizará estas rutas:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

El versionado se aplicará mediante las APIs nativas de NestJS, sin incluir `api/v1` manualmente en
los paths de los controladores. Cuando `API_GLOBAL_PREFIX` tenga un valor vacío explícito, las
mismas operaciones se publicarán como `/v1/health/live` y `/v1/health/ready`.

## Límite de responsabilidad del routing

DNS y el proxy o ingress determinan qué dominio recibe la solicitud y a qué servicio se envía.
NestJS solo controla el path dentro de la aplicación. El proxy deberá documentar si preserva o
reescribe ese path; `API_GLOBAL_PREFIX` no configura dominios, restringe hosts ni concede acceso.

## Decisiones confirmadas

| Tema              | Decisión                                              |
| ----------------- | ----------------------------------------------------- |
| Estrategia        | URI Versioning nativo de NestJS                       |
| Prefijo global    | Configurable; `api` por defecto y vacío para omitirlo |
| Versión inicial   | `1`, expuesta como `v1`                               |
| Declaración       | Versión explícita en cada controlador público         |
| Healthchecks      | Versionados como parte del contrato HTTP público      |
| Rutas anteriores  | Migración directa; `/health/*` responderá `404`       |
| Fuente de versión | Constante tipada propiedad del código                 |
| `APP_VERSION`     | Continúa representando la versión del software        |
| OpenAPI           | Fuera de alcance; se implementará por separado        |
| Versiones futuras | Solo para breaking changes del contrato público       |

Estas decisiones fijan el alcance de la implementación. Cualquier cambio posterior deberá revisar
las pruebas y la documentación antes de modificar el contrato HTTP.

## Alcance

### Incluido

- Habilitar URI Versioning y un prefijo global opcional.
- Crear el namespace `api` con `API_GLOBAL_PREFIX`, default `api` y soporte para valor vacío.
- Declarar la versión inicial en los controladores públicos existentes.
- Migrar las pruebas unitarias y E2E al nuevo contrato.
- Verificar que las rutas sin versión y las versiones inexistentes no estén expuestas.
- Actualizar la documentación que publica o prueba las rutas actuales.

### Fuera de alcance

- Crear una API V2 funcional.
- Implementar Swagger u OpenAPI.
- Diseñar headers o calendarios de deprecation.
- Mantener aliases temporales para rutas no versionadas.
- Separar módulos o servicios por versión sin una incompatibilidad real.

## Archivos previstos

| Archivo                                     | Cambio                                              |
| ------------------------------------------- | --------------------------------------------------- |
| `src/config/api.config.ts`                  | Definir y validar `API_GLOBAL_PREFIX`               |
| `src/config/api.config.spec.ts`             | Probar default, valor vacío y entradas inválidas    |
| `src/app.module.ts`                         | Registrar el namespace `api`                        |
| `src/main.ts`                               | Resolver la configuración tipada y pasarla al setup |
| `src/app.setup.ts`                          | Configurar el prefijo opcional y URI Versioning     |
| `src/app.setup.spec.ts`                     | Probar la configuración transversal                 |
| `src/modules/health/health.controller.ts`   | Declarar la versión `1`                             |
| `test/support/create-e2e-application.ts`    | Usar la misma configuración `api` que producción    |
| `test/modules/health/health.e2e-suite.ts`   | Probar rutas con y sin prefijo                      |
| `test/support/e2e-rate-limit.controller.ts` | Declarar o adaptar la versión de la ruta auxiliar   |
| `README.md`                                 | Publicar las rutas predeterminadas                  |
| `docs/architecture/configuration.md`        | Documentar la responsabilidad del namespace `api`   |
| `docs/configuration/http-security.md`       | Documentar `API_GLOBAL_PREFIX` y su operación       |
| `docs/testing/e2e-testing.md`               | Actualizar el contrato observado por E2E            |
| `docs/api/versioning.md`                    | Distinguir versión y prefijo configurable           |

## Plan de implementación

### 1. Fijar el contrato

1. Mantener `docs/api/versioning.md` como owner de las reglas del contrato HTTP.
2. Definir una constante tipada para la versión inicial.
3. Crear el namespace `api` y la variable `API_GLOBAL_PREFIX` con `api` como default.
4. Interpretar el valor vacío explícito como ausencia de prefijo.
5. No introducir una variable de entorno `API_VERSION`.
6. No reutilizar `APP_VERSION`: esa propiedad identifica la versión del software y no las rutas.

`API_GLOBAL_PREFIX` deberá aceptar paths relativos normalizados, como `api` o `platform/api`, y
rechazar slash inicial o final, segmentos vacíos, `.`, `..`, espacios, query strings y fragments.

### 2. Escribir pruebas unitarias RED

Actualizar `src/app.setup.spec.ts` para exigir que `setupApplication()`:

1. Llame a `app.setGlobalPrefix('api')` con la configuración predeterminada.
2. Omita `app.setGlobalPrefix()` cuando `globalPrefix` esté vacío.
3. Llame a `app.enableVersioning()` con `VersioningType.URI`.
4. Configure la versión inicial como `'1'`.
5. Mantenga sin cambios Helmet, CORS y trust proxy.
6. No derive la versión HTTP desde la configuración `app.version`.

El double de `INestApplication` deberá incorporar `setGlobalPrefix` y `enableVersioning`.

### 3. Configurar el boundary HTTP

Modificar `src/app.setup.ts` para:

1. Importar `VersioningType` desde `@nestjs/common`.
2. Recibir la configuración tipada del namespace `api`.
3. Invocar `setGlobalPrefix()` únicamente cuando `globalPrefix` no esté vacío.
4. Habilitar URI Versioning con versión inicial `1`.
5. Mantener la configuración en `setupApplication()` para que producción y E2E usen el mismo
   bootstrap.
6. Conservar el comportamiento actual de trust proxy, Helmet y CORS.

No se deben codificar segmentos `api/v1` dentro de `@Controller()`.

### 4. Versionar los controladores

Modificar `src/modules/health/health.controller.ts` para declarar explícitamente la versión `1` a
nivel de controlador.

La declaración explícita debe hacer visible el contrato aunque exista una versión por defecto. Las
versiones futuras deberán permanecer dentro del módulo propietario del feature y compartir servicios
solo cuando mantengan la misma semántica.

### 5. Migrar las pruebas E2E

Actualizar `test/modules/health/health.e2e-suite.ts` para:

1. Probar `/api/v1/health/live` y `/api/v1/health/ready` con la configuración predeterminada.
2. Probar `/v1/health/live` y `/v1/health/ready` con `API_GLOBAL_PREFIX` vacío.
3. Ejecutar sobre las rutas predeterminadas las comprobaciones actuales de Terminus, Helmet, CORS y
   throttling.
4. Verificar que `/health/live` y `/health/ready` respondan `404` en ambos modos.
5. Verificar que `/api/v2/health/live` responda `404` mientras V2 no exista.
6. Conservar la comprobación de que `/` no expone una ruta raíz.

Adaptar `test/support/e2e-rate-limit.controller.ts` y su prueba para que la ruta auxiliar participe
del mismo mecanismo de prefijo y versión. No añadir excepciones de bootstrap únicamente para
facilitar las pruebas.

### 6. Triangular el mecanismo

Añadir una prueba mínima que demuestre que NestJS discrimina versiones y no solo concatena un
prefijo. La opción preferida es un controlador exclusivo de E2E con handlers pequeños para las
versiones `1` y `2`.

Si esta prueba aumenta desproporcionadamente el soporte E2E, documentar la decisión y limitar la
triangulación a comprobar una versión inexistente.

### 7. Actualizar la documentación

1. Sustituir las rutas antiguas en `README.md`.
2. Actualizar `docs/testing/e2e-testing.md` con las rutas observables finales.
3. Enlazar `docs/api/versioning.md` en lugar de duplicar allí sus reglas.
4. Modificar `docs/api/versioning.md` solo si se introduce una excepción para healthchecks,
   compatibilidad temporal o configuración operacional de la versión.
5. Mantener OpenAPI fuera del cambio y registrar su implementación como trabajo independiente.

### 8. Refactorizar sin sobrearquitectura

Después de alcanzar GREEN:

1. Eliminar literales duplicados solo cuando exista un owner claro.
2. No crear controladores V2 vacíos.
3. No separar módulos por versión mientras solo exista V1.
4. No introducir aliases, middleware o redirects sin un requisito de compatibilidad.
5. Confirmar que producción y E2E continúan usando `setupApplication()`.

## Orden de verificación

Ejecutar las verificaciones desde las más enfocadas hasta las más amplias:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm build
```

Para la documentación modificada:

```bash
pnpm prettier --write README.md docs/testing/e2e-testing.md \
  docs/plans/api-versioning/implementation-plan.md
pnpm lint:md
```

Antes de iniciar una revisión RDD, ejecutar el workflow configurado para archivos candidatos hasta
que una segunda ejecución no produzca cambios:

```bash
pnpm lint-staged
```

## Criterios de aceptación

- [ ] `GET /api/v1/health/live` responde `200` con el prefijo predeterminado.
- [ ] `GET /api/v1/health/ready` responde `200` con el prefijo predeterminado.
- [ ] `GET /v1/health/live` y `GET /v1/health/ready` responden `200` cuando el prefijo está vacío.
- [ ] Las entradas inválidas de `API_GLOBAL_PREFIX` detienen el startup con un error claro.
- [ ] Helmet, CORS y la exclusión de throttling permanecen sin regresiones.
- [ ] `/api/v2/health/live` responde `404` mientras V2 no exista.
- [ ] `/health/live` y `/health/ready` responden `404` tanto con prefijo como sin él.
- [ ] La ruta auxiliar E2E continúa demostrando que el throttling global está activo.
- [ ] Producción y E2E obtienen el versionado desde el mismo setup.
- [ ] `APP_VERSION` no afecta la versión de las rutas HTTP.
- [ ] README y documentación de testing muestran las rutas finales.
- [ ] Pruebas unitarias, E2E, lint, Markdown lint y build finalizan correctamente.

## Riesgos y mitigaciones

| Riesgo                                        | Mitigación                                                            |
| --------------------------------------------- | --------------------------------------------------------------------- |
| Romper probes configurados con `/health/*`    | Actualizar ejemplos y validar configuraciones de despliegue conocidas |
| Desalinear ingress y prefijo de NestJS        | Documentar si el proxy preserva o reescribe el path                   |
| Generar prefijos dobles o rutas inesperadas   | Validar y normalizar `API_GLOBAL_PREFIX` antes del bootstrap          |
| Exponer el servicio por un host no previsto   | Restringir hosts y upstreams en el proxy; el prefijo no autoriza      |
| Versionar accidentalmente desde `APP_VERSION` | Mantener contratos y owners separados                                 |
| Diferencias entre producción y E2E            | Configurar todo en `setupApplication()`                               |
| Rutas auxiliares E2E dejan de resolver        | Declarar su versión y probar su URL final                             |
| Complejidad prematura para V2                 | Crear una nueva versión solo ante un breaking change real             |
| Documentación inconsistente                   | Actualizar cada owner y ejecutar Prettier y markdownlint              |

## Referencias

- Estrategia del proyecto: `docs/api/versioning.md`.
- Contrato OpenAPI objetivo: `docs/api/openapi.md`.
- Convenciones E2E: `docs/testing/e2e-testing.md`.
- Configuración existente: `docs/plans/configuration/separacion-de-configuracion-por-namespaces.md`.
- Documentación oficial de NestJS: <https://docs.nestjs.com/techniques/versioning>.
