# Plan de implementación de healthchecks

Este plan incorpora healthchecks HTTP básicos con `@nestjs/terminus`, separa la capacidad en un Feature Module y elimina
el endpoint demostrativo `GET /`. El cambio cubrirá únicamente la salud del proceso NestJS; la información pública de la
aplicación y los checks de dependencias quedan fuera de alcance.

## Resultado esperado

```text
src/modules/health/
├── health.controller.spec.ts
├── health.controller.ts
└── health.module.ts
```

La aplicación expondrá dos probes operativos:

| Método | Ruta            | Propósito                                                         |
| ------ | --------------- | ----------------------------------------------------------------- |
| `GET`  | `/health/live`  | Confirmar que el proceso HTTP está vivo y responde                |
| `GET`  | `/health/ready` | Confirmar, temporalmente, que la aplicación puede recibir tráfico |

Ambos endpoints usarán el contrato estándar de Terminus y quedarán fuera del límite global de solicitudes.

## Alcance acordado

- Añadir `@nestjs/terminus` como dependencia de producción.
- Crear un módulo funcional dedicado a healthchecks.
- Implementar liveness y readiness sin consultar dependencias internas o externas.
- Excluir ambos probes del `ThrottlerGuard` global.
- Eliminar `GET /`, `AppController`, `AppService` y sus pruebas obsoletas.
- Conservar la cobertura E2E de Helmet, CORS, preflight y rate limiting.
- Actualizar la documentación que presenta `GET /` como contrato vigente.

## Contratos HTTP

### Liveness

`GET /health/live` responderá `200 OK` cuando NestJS pueda procesar la solicitud.

Respuesta esperada:

```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

Este probe no comprobará base de datos, red, memoria, disco ni servicios externos. Su resultado no debe depender de
recursos ajenos al proceso HTTP.

### Readiness

`GET /health/ready` responderá inicialmente con el mismo contrato básico:

```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

En esta etapa, readiness significa únicamente que la aplicación terminó de iniciar y puede responder HTTP. Cuando
existan dependencias obligatorias para atender tráfico, sus indicadores se añadirán a este endpoint sin alterar la
responsabilidad de liveness.

### Comportamiento transversal

- Los dos endpoints heredarán Helmet y la política CORS global.
- Los dos endpoints estarán exentos del rate limiting mediante la API declarativa de `@nestjs/throttler`.
- No se expondrán stack traces, configuración, variables de entorno ni metadatos de la aplicación.
- No se incorporará autenticación en esta etapa, para permitir el uso directo por orquestadores y balanceadores.

## Diseño del módulo

### `HealthModule`

`src/modules/health/health.module.ts` será propietario de la capacidad y deberá:

1. Importar `TerminusModule`.
2. Registrar `HealthController`.
3. Encapsular la integración con Terminus sin exportar providers que otros módulos no necesiten.

`AppModule` importará `HealthModule` y dejará de registrar el controlador y servicio demostrativos.

### `HealthController`

`src/modules/health/health.controller.ts` deberá:

1. Definir el prefijo `health`.
2. Inyectar `HealthCheckService` mediante el constructor.
3. Declarar `GET /live` y `GET /ready` con `@HealthCheck()`.
4. Ejecutar el healthcheck básico sin indicadores de dependencias.
5. Declarar explícitamente la exclusión del throttling.
6. Mantener métodos separados para preservar la diferencia semántica entre liveness y readiness.

No se añadirá un servicio propio mientras no exista lógica de salud independiente de Terminus.

## Estrategia de pruebas

La implementación seguirá RED, GREEN y REFACTOR. Las pruebas fijarán primero el contrato observable y evitarán depender
de detalles internos de Terminus que no formen parte del API HTTP.

### Pruebas unitarias

Crear `src/modules/health/health.controller.spec.ts` para comprobar que:

- El controlador delega ambos probes a `HealthCheckService`.
- Liveness ejecuta únicamente el conjunto básico de checks.
- Readiness ejecuta únicamente el conjunto básico de checks.
- Cada método devuelve el resultado entregado por Terminus.

La prueba no duplicará la implementación interna de `HealthCheckService`.

### Pruebas E2E

Actualizar la suite E2E para verificar:

- `GET /health/live` responde `200` con el contrato estándar de Terminus.
- `GET /health/ready` responde `200` con el mismo contrato inicial.
- Ambos endpoints conservan los headers de seguridad configurados por Helmet.
- Una solicitud CORS permitida conserva los headers esperados.
- El preflight de una ruta de health responde según la política CORS existente.
- Solicitudes repetidas a los probes no producen `429` bajo el límite configurado para la prueba.
- `GET /` deja de existir y responde `404`.

La cobertura del rate limiting global no deberá depender de los probes excluidos. La suite utilizará una ruta controlada
exclusiva del entorno de pruebas, o el mecanismo de composición E2E existente, para demostrar que una ruta no excluida
continúa produciendo `429`. Esa ruta no formará parte del contrato de producción.

## Fases de implementación

### Fase 1: instalar y registrar Terminus

1. Añadir la versión de `@nestjs/terminus` compatible con NestJS 12.
2. Actualizar `pnpm-lock.yaml` mediante pnpm, sin editarlo manualmente.
3. Crear `HealthModule` e importar `TerminusModule`.
4. Importar `HealthModule` desde `AppModule`.

Criterio de salida: Nest resuelve el módulo y `HealthCheckService` sin errores de inyección.

### Fase 2: fijar los contratos en pruebas

1. Crear pruebas unitarias fallidas para liveness y readiness.
2. Añadir escenarios E2E fallidos para rutas, status codes y payloads.
3. Añadir un escenario que demuestre la exclusión del throttling.
4. Añadir un escenario que espere `404` para `GET /`.

Criterio de salida: las pruebas nuevas fallan porque los contratos todavía no están implementados.

### Fase 3: implementar los probes

1. Crear `HealthController` bajo `src/modules/health/`.
2. Implementar los métodos separados de liveness y readiness.
3. Aplicar `@HealthCheck()` a ambos métodos.
4. Excluir el controlador o sus rutas del throttling.
5. Confirmar que no se ejecuten checks de dependencias.

Criterio de salida: ambos endpoints responden con el contrato esperado y nunca reciben `429` en el escenario E2E
controlado.

### Fase 4: eliminar Hello World

1. Retirar `AppController` y `AppService` de `AppModule`.
2. Eliminar `src/app.controller.ts`.
3. Eliminar `src/app.controller.spec.ts`.
4. Eliminar `src/app.service.ts`.
5. Buscar referencias restantes a `getHello`, `Hello World!` y al contrato anterior de `GET /`.

Criterio de salida: no quedan referencias ejecutables al endpoint demostrativo y `GET /` responde `404`.

### Fase 5: triangular políticas HTTP

1. Mover las comprobaciones E2E de Helmet a una ruta de health.
2. Mover las comprobaciones de CORS y preflight a una ruta de health.
3. Verificar que ambos probes omitan el throttling.
4. Conservar la prueba del guard global mediante una ruta exclusiva de pruebas que no esté excluida.
5. Confirmar que el bootstrap E2E conserva el mismo setup global que producción.

Criterio de salida: eliminar `GET /` no reduce la cobertura de las políticas HTTP transversales.

### Fase 6: actualizar documentación

1. Actualizar `README.md` para sustituir el endpoint demostrativo por los probes disponibles.
2. Actualizar `docs/testing/e2e-testing.md` con las nuevas rutas y responsabilidades de la suite.
3. Documentar que readiness todavía no comprueba dependencias.
4. Evitar documentar el futuro endpoint de información como una capacidad existente.

Criterio de salida: ningún documento presenta `GET /` o `Hello World!` como contrato vigente.

### Fase 7: verificación final

1. Ejecutar Prettier sobre los archivos modificados.
2. Ejecutar pruebas unitarias.
3. Ejecutar pruebas E2E.
4. Ejecutar lint y markdownlint.
5. Ejecutar el build de producción.
6. Revisar que el diff permanezca dentro del alcance acordado.

Criterio de salida: todas las verificaciones terminan correctamente y no existen cambios de contenido producidos por una
segunda ejecución del formateador.

## Archivos previstos

### Nuevos

- `src/modules/health/health.module.ts`
- `src/modules/health/health.controller.ts`
- `src/modules/health/health.controller.spec.ts`

### Modificados

- `src/app.module.ts`
- `package.json`
- `pnpm-lock.yaml`
- `test/modules/app/app.e2e-suite.ts`
- Soporte E2E estrictamente necesario para disponer de una ruta no excluida del throttling
- `README.md`
- `docs/testing/e2e-testing.md`

### Eliminados

- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/app.service.ts`

## Riesgos y mitigaciones

<!-- markdownlint-disable MD013 -->

| Riesgo                                        | Mitigación                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Confundir liveness con readiness              | Mantener rutas y métodos separados, aunque inicialmente compartan checks |
| Probes bloqueados por rate limiting           | Declarar la exclusión y probar solicitudes repetidas                     |
| Readiness produce una señal demasiado débil   | Documentar su semántica temporal y ampliarla cuando existan dependencias |
| Perder cobertura al eliminar `GET /`          | Trasladar pruebas transversales antes de retirar la ruta                 |
| Probar throttling mediante una ruta operativa | Usar una ruta exclusiva del entorno E2E, ausente en producción           |
| Acoplar health a configuración pública        | No inyectar `appConfig` ni exponer metadatos                             |
| Añadir indicadores prematuros                 | Mantener vacío el conjunto de checks de dependencias                     |
| Exponer detalles internos                     | Conservar únicamente el contrato estándar y estable de Terminus          |

<!-- markdownlint-enable MD013 -->

## Criterios de aceptación

- [ ] `@nestjs/terminus` está instalado con una versión compatible con NestJS 12.
- [ ] Existe un `HealthModule` autocontenido bajo `src/modules/health/`.
- [ ] `GET /health/live` responde `200` con el contrato estándar de Terminus.
- [ ] `GET /health/ready` responde `200` con el contrato estándar de Terminus.
- [ ] Ningún probe consulta base de datos, red, disco, memoria o servicios externos.
- [ ] Los probes no reciben `429` por el throttling global.
- [ ] Una ruta E2E no excluida confirma que el throttling global sigue activo.
- [ ] Helmet, CORS y preflight conservan su comportamiento observable.
- [ ] `GET /` responde `404`.
- [ ] No existen `AppController`, `AppService`, `getHello` ni `Hello World!` en el código activo.
- [ ] No se expone nombre, versión, descripción ni configuración de la aplicación.
- [ ] README y documentación E2E reflejan el contrato nuevo.
- [ ] Pruebas unitarias, E2E, lint, formato, markdownlint y build finalizan correctamente.

## Verificación

Ejecutar durante la implementación las comprobaciones enfocadas de cada fase y, al finalizar:

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
rg "getHello|Hello World|AppController|AppService" src test README.md docs
```

## Fuera de alcance

- Crear `GET /info` o cualquier endpoint equivalente.
- Exponer nombre, versión, descripción, entorno o configuración.
- Crear un módulo de información de la aplicación.
- Comprobar bases de datos, colas, cachés, almacenamiento o APIs externas.
- Añadir indicadores de memoria o disco.
- Definir objetivos de disponibilidad o tiempos de respuesta.
- Configurar probes de Kubernetes, Docker Compose o infraestructura de despliegue.
- Añadir autenticación o autorización a los probes.
- Aplicar versionado URI u OpenAPI.
- Cambiar la configuración global de Helmet, CORS o rate limiting.
- Realizar commits, publicar paquetes o desplegar la aplicación.
