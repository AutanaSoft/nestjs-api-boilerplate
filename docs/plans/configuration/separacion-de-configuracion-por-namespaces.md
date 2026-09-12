# Plan para separar la configuración por namespaces

Este plan divide la configuración monolítica actual en cuatro namespaces cohesivos: `app`, `http`,
`cors` y `rateLimit`. La migración conservará las variables de entorno existentes, la validación
temprana con Zod, la inyección tipada de `@nestjs/config` y el comportamiento HTTP observable.

## Resultado esperado

```text
src/config/
├── app.config.ts
├── app.config.spec.ts
├── cors.config.ts
├── cors.config.spec.ts
├── http.config.ts
├── http.config.spec.ts
├── rate-limit.config.ts
└── rate-limit.config.spec.ts
```

Cada namespace será propietario de sus entradas externas, valores predeterminados, normalización,
valores derivados, validación y tipo final de solo lectura.

## Alcance acordado

| Namespace   | Responsabilidad                                       | Variables de entorno                                     |
| ----------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `app`       | Entorno e identidad pública de la aplicación          | `NODE_ENV`, `APP_NAME`, `APP_DESCRIPTION`, `APP_VERSION` |
| `http`      | Puerto del servidor y confianza en proxies            | `PORT`, `TRUST_PROXY_HOPS`                               |
| `cors`      | Política CORS completa                                | `CORS_ORIGINS`, `CORS_MAX_AGE_SECONDS`                   |
| `rateLimit` | Límites globales de solicitudes para NestJS Throttler | `THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT`                 |

## Decisiones confirmadas

- `APP_NAME`, `APP_DESCRIPTION` y `APP_VERSION` serán overrides opcionales.
- Sus defaults serán `NestJS 12 API`, la descripción actual de `package.json` y `0.0.1`.
- Los overrides vacíos serán inválidos y detendrán el startup.
- `APP_VERSION` representa la versión del software; `API_VERSION` se añadirá cuando se implemente el
  versionado HTTP y permanece fuera de este cambio.
- CORS permitirá `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` y `QUERY`.
- CORS aceptará los headers `Accept`, `Authorization` y `Content-Type`.
- CORS no expondrá headers adicionales inicialmente.
- `CORS_MAX_AGE_SECONDS` tendrá default `600` y aceptará enteros entre `0` y `86400`; el valor `0`
  desactivará el caché de preflight.

## Diseño de los namespaces

### Configuración de aplicación

Crear `src/config/app.config.ts` con el namespace `app`.

Contrato final previsto:

```text
app
├── nodeEnv
├── name
├── description
└── version
```

Decisiones confirmadas:

- `name` representa el nombre humano de la aplicación, no el identificador npm.
- `APP_NAME` tendrá el default `NestJS 12 API`.
- `APP_DESCRIPTION` tendrá el default
  `A secure NestJS 12 API boilerplate for TypeScript applications.`.
- `APP_VERSION` tendrá el default `0.0.1`.
- Los tres valores admitirán overrides no vacíos mediante variables de entorno.
- `APP_VERSION` no se utilizará para versionar rutas HTTP.
- El namespace construirá y validará todos sus metadatos antes de exponerlos.
- El contrato será de solo lectura.

Los defaults de description y version reflejarán inicialmente `package.json`, pero permanecerán
explícitos en el configuration boundary. El nombre técnico `package.json#name` continuará siendo
independiente del nombre humano.

### Configuración HTTP

Reducir `src/config/http.config.ts` para que el namespace `http` contenga únicamente:

```text
http
├── port
└── trustProxyHops
```

Se conservarán estas reglas:

- `PORT` tendrá el valor predeterminado `3000` y aceptará enteros entre `1` y `65535`.
- `TRUST_PROXY_HOPS` tendrá el valor predeterminado `0` y aceptará enteros entre `0` y `255`.
- `src/main.ts` consumirá `http.port` para iniciar el servidor.
- `src/app.setup.ts` consumirá `http.trustProxyHops` para configurar Express.

### Configuración CORS

Crear `src/config/cors.config.ts` con el namespace `cors`.

Contrato final previsto:

```text
cors
├── origins
├── methods
├── allowedHeaders
├── exposedHeaders
├── credentials
├── maxAge
├── preflightContinue
└── optionsSuccessStatus
```

Solo serán configurables mediante el entorno:

- `CORS_ORIGINS`;
- `CORS_MAX_AGE_SECONDS`.

El resto representará una política estable definida y validada dentro del namespace. Se mantendrán
estas decisiones:

- `methods` será `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` y `QUERY`.
- `allowedHeaders` será `Accept`, `Authorization` y `Content-Type`.
- `exposedHeaders` será una lista vacía.
- `credentials` será siempre `false`.
- `maxAge` tendrá default `600` segundos y aceptará enteros entre `0` y `86400`.
- `preflightContinue` será siempre `false`.
- `optionsSuccessStatus` será siempre `204`.
- `CORS_ORIGINS` será obligatorio y no vacío en producción.
- Fuera de producción, el origen predeterminado continuará siendo `http://localhost:3000`.
- Solo se permitirán orígenes HTTP y HTTPS.
- Se rechazarán wildcards, credenciales en la URL, paths distintos de `/`, query strings y
  fragments.
- Los valores serán recortados y normalizados mediante `URL.origin`.
- Se rechazarán entradas vacías y orígenes duplicados, incluso después de normalizarlos.

La regla que hace obligatorio `CORS_ORIGINS` en producción seguirá siendo responsabilidad de CORS.
Su diseño deberá evitar que los consumidores repitan esta validación.

### Configuración de rate limiting

Crear `src/config/rate-limit.config.ts` con el namespace `rateLimit`.

Contrato final:

```text
rateLimit
└── global
    ├── ttlMs
    └── limit
```

Solo se admitirán estos inputs externos:

- `THROTTLE_TTL_SECONDS`;
- `THROTTLE_LIMIT`.

Se conservarán estas reglas:

- TTL predeterminado de `60` segundos.
- Límite predeterminado de `100` solicitudes por ventana.
- Ambos valores deben ser enteros positivos.
- La factory convertirá segundos a milisegundos antes de exponer `ttlMs`.
- Los límites particulares de endpoints permanecerán cerca de sus propietarios y no se añadirán al
  entorno global.
- El almacenamiento seguirá siendo local y en memoria, con contadores independientes por réplica.

## Patrón común de implementación

Cada archivo de configuración deberá:

1. Definir el schema de sus inputs externos cuando corresponda.
2. Definir el schema de su configuración final.
3. Exportar un tipo final de solo lectura.
4. Exportar una factory nombrada que construya el namespace completo.
5. Aplicar defaults, overrides explícitos, normalización, valores derivados y validación final, en
   ese orden.
6. Registrar la factory mediante `registerAs` con un nombre corto y estable.
7. Exportar por defecto el namespace registrado.

Los consumidores conocidos usarán `config.KEY` y `ConfigType<typeof config>`. No se incorporará
`ConfigService` ni se realizarán búsquedas mediante rutas string.

## Fases de implementación

### Fase 1: validar los contratos acordados

1. Traducir las decisiones confirmadas a pruebas fallidas antes de crear las factories.
2. Confirmar que cada input tiene default, formato, rango y política de valores vacíos definidos.
3. Verificar mediante pruebas que las opciones CORS explícitas producen el contrato esperado sin
   depender de defaults implícitos del middleware.

Criterio de salida: las pruebas representan todos los contratos acordados y fallan por la ausencia
de la implementación nueva.

### Fase 2: separar `app` y `http`

1. Crear pruebas fallidas para el contrato `app`.
2. Implementar `app.config.ts` con su factory, schemas, tipo y namespace.
3. Modificar las pruebas de `http` para esperar únicamente `port` y `trustProxyHops`.
4. Reducir `http.config.ts` conservando sus defaults y rangos actuales.
5. Verificar que los dos namespaces fallen durante startup ante entradas inválidas.

Criterio de salida: `httpConfig` no contiene metadatos, CORS ni rate limiting.

### Fase 3: extraer CORS

1. Crear pruebas fallidas para defaults, overrides y política CORS.
2. Trasladar la normalización y validación actuales de orígenes sin simplificarlas.
3. Añadir la validación de `CORS_MAX_AGE_SECONDS`.
4. Materializar y validar las opciones CORS estables acordadas.
5. Actualizar `src/app.setup.ts` para recibir contratos `HttpConfig` y `CorsConfig` separados.
6. Actualizar sus pruebas para verificar todas las opciones enviadas a `enableCors`.

Criterio de salida: ninguna propiedad CORS permanece en `httpConfig` y el comportamiento de
preflight se conserva.

### Fase 4: extraer rate limiting

1. Crear pruebas fallidas para el namespace `rateLimit` y su propiedad `global`.
2. Implementar la factory conservando coerción, defaults y conversión a milisegundos.
3. Registrar el namespace en el módulo raíz.
4. Cambiar `ThrottlerModule.forRootAsync` para inyectar únicamente `rateLimitConfig.KEY`.
5. Verificar que el módulo use `global.ttlMs` y `global.limit`.

Criterio de salida: NestJS Throttler no depende de `httpConfig`.

### Fase 5: actualizar composición y bootstrap

1. Registrar `appConfig`, `httpConfig`, `corsConfig` y `rateLimitConfig` en
   `ConfigModule.forRoot({ load })`.
2. Actualizar `src/main.ts` para resolver únicamente los namespaces requeridos.
3. Actualizar `test/support/create-e2e-application.ts` para reproducir el mismo ensamblaje que
   producción.
4. Adaptar las pruebas del helper E2E sin hacerlas dependientes de un orden innecesario de
   resolución de tokens.
5. Confirmar que ningún consumidor acceda directamente a `process.env`.

Criterio de salida: producción y E2E construyen la aplicación con los mismos namespaces y la misma
función de setup.

### Fase 6: triangular el comportamiento

Ejecutar las pruebas E2E y confirmar que:

- `GET /` continúa devolviendo el mismo contrato.
- Helmet conserva sus headers.
- Los orígenes CORS permitidos y denegados conservan su comportamiento.
- El preflight continúa respondiendo con `204`.
- El límite configurado continúa produciendo la secuencia esperada `200`, `200`, `429` en el
  escenario controlado.
- `Access-Control-Max-Age` coincide con el contrato acordado.

Criterio de salida: la reorganización interna no produce regresiones HTTP.

### Fase 7: actualizar documentación y entorno

1. Actualizar `docs/architecture/configuration.md` con los cuatro namespaces y sus propietarios.
2. Actualizar `docs/configuration/http-security.md` con los namespaces `http`, `cors` y `rateLimit`,
   sus variables, defaults y restricciones.
3. Actualizar `docs/testing/e2e-testing.md` únicamente si cambia su descripción del ensamblaje.
4. Revisar `.env.example` y añadir solo las variables operativas acordadas.
5. Eliminar referencias documentales al antiguo objeto monolítico.

Criterio de salida: la arquitectura conserva las reglas generales y la documentación operativa posee
los valores concretos.

## Archivos previstos

### Nuevos

- `src/config/app.config.ts`
- `src/config/app.config.spec.ts`
- `src/config/cors.config.ts`
- `src/config/cors.config.spec.ts`
- `src/config/rate-limit.config.ts`
- `src/config/rate-limit.config.spec.ts`

### Modificados

- `src/config/http.config.ts`
- `src/config/http.config.spec.ts`
- `src/app.module.ts`
- `src/main.ts`
- `src/app.setup.ts`
- `src/app.setup.spec.ts`
- `test/support/create-e2e-application.ts`
- `test/support/create-e2e-application.spec.ts`
- `docs/architecture/configuration.md`
- `docs/configuration/http-security.md`
- `.env.example`, si existe y contiene la referencia operativa del proyecto

### Revisados según necesidad

- `test/support/e2e-environment.spec.ts`
- `vitest.config.e2e.ts`
- `docs/testing/e2e-testing.md`

## Riesgos y mitigaciones

| Riesgo                                               | Mitigación                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| Perder la regla CORS de producción                   | Mantener una prueba específica para ausencia de `CORS_ORIGINS`        |
| Alterar defaults implícitos de CORS                  | Fijar primero los valores y triangular headers/preflight              |
| Registrar u obtener un token incorrecto              | Probar resolución real de los cuatro namespaces                       |
| Confundir segundos y milisegundos                    | Probar explícitamente la conversión en `rateLimitConfig`              |
| Divergencia entre bootstrap real y E2E               | Compartir `setupApplication` y verificar ambos composition roots      |
| Acoplar CORS al namespace `app`                      | Mantener la invariancia de producción dentro del boundary de CORS     |
| Desalinear defaults respecto de `package.json`       | Actualizar defaults y package metadata en la misma unidad de trabajo  |
| Introducir configuración operativa innecesaria       | Exponer solo las variables de entorno acordadas                       |
| Romper tipos readonly al llamar APIs de Nest/Express | Realizar una copia localizada en el adapter, solo si el tipo lo exige |

## Criterios de aceptación

- [ ] Existen los namespaces exactos `app`, `http`, `cors` y `rateLimit`.
- [ ] Cada namespace produce un contrato completo, tipado, de solo lectura y validado con Zod.
- [ ] `appConfig` contiene `nodeEnv`, `name`, `description` y `version`.
- [ ] El nombre humano predeterminado es `NestJS 12 API`.
- [ ] Description y version tienen los defaults actuales de `package.json`.
- [ ] Los tres metadatos admiten overrides no vacíos mediante variables de entorno.
- [ ] `API_VERSION` no se incorpora en este cambio.
- [ ] `httpConfig` contiene únicamente `port` y `trustProxyHops`.
- [ ] `corsConfig` solo acepta overrides de `CORS_ORIGINS` y `CORS_MAX_AGE_SECONDS`.
- [ ] Se conservan todas las restricciones actuales de los orígenes CORS.
- [ ] Los métodos y headers CORS coinciden exactamente con las listas acordadas.
- [ ] CORS no expone headers adicionales.
- [ ] `CORS_MAX_AGE_SECONDS` tiene default `600` y rango entero entre `0` y `86400`.
- [ ] `rateLimitConfig` expone `global.ttlMs` y `global.limit`.
- [ ] Solo `THROTTLE_TTL_SECONDS` y `THROTTLE_LIMIT` modifican el límite global.
- [ ] `ThrottlerModule` consume el token tipado de `rateLimitConfig`.
- [ ] No existen accesos a `process.env` fuera de las factories de configuración.
- [ ] La configuración inválida continúa deteniendo el startup.
- [ ] No quedan referencias al shape monolítico anterior.
- [ ] Producción y E2E usan la misma configuración de setup.
- [ ] No cambian rutas, payloads, status codes ni políticas HTTP existentes fuera del contrato CORS
      acordado.
- [ ] Pruebas unitarias, E2E, lint, formato y build finalizan correctamente.
- [ ] La documentación arquitectónica y operativa queda actualizada.

## Verificación

Ejecutar las comprobaciones enfocadas durante cada fase y, al finalizar:

```bash
pnpm test
pnpm run test:e2e
pnpm lint
pnpm build
pnpm exec prettier --check .
pnpm run lint:md
```

Buscar referencias obsoletas antes de cerrar el cambio:

```bash
rg "config\.throttle|config\.corsOrigins|config\.corsCredentials|httpConfig.*nodeEnv" src test
```

## Fuera de alcance

- Cambiar controladores, servicios, rutas o contratos de respuesta.
- Aplicar versionado URI u OpenAPI.
- Añadir autenticación o autorización.
- Cambiar Helmet.
- Sustituir el almacenamiento en memoria de NestJS Throttler.
- Configurar límites por endpoint mediante variables de entorno.
- Introducir `ConfigService` o un namespace agregado.
- Añadir dependencias.
- Incorporar configuración mutable después del startup.
- Importar dinámicamente metadatos desde `package.json`.
- Añadir `API_VERSION` antes de implementar el versionado HTTP.
- Realizar commits o publicar cambios.
