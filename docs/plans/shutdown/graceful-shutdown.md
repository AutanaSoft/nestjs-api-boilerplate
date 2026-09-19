# Plan de implementación: apagado ordenado (OB-12)

Este plan registra la implementación completada de **OB-12**. El proceso detiene la admisión HTTP, ejecuta el cierre de
NestJS y sus responsables de recursos dentro de un plazo total configurable de **10 segundos** por defecto, y deja un
resultado observable y seguro.

## Resultado y decisiones fijadas

<!-- markdownlint-disable MD013 -->

| Tema               | Decisión de implementación                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Señales atendidas  | Solo `SIGTERM` y `SIGINT`.                                                                                                             |
| Cierre correcto    | Conservar y reemitir la señal original mediante `process.kill(process.pid, signal)`; no usar `useProcessExit`.                         |
| Plazo              | Un único plazo total `SHUTDOWN_TIMEOUT_MS`, predeterminado `10_000` ms, que abarca el cierre completo.                                 |
| Vencimiento        | Emitir exactamente un evento crítico síncrono y seguro, y terminar forzadamente con código `1`.                                        |
| Rechazo de cierre  | No reintentar hooks; emitir una vez `shutdown.failed` mediante el sink de emergencia y terminar con código `1`.                        |
| Readiness draining | Diferido: la readiness actual no tiene estado de draining ni dependencias; OB-12 solo cierra el listener.                              |
| Pruebas de proceso | Un target POSIX aislado construye primero y ejecuta la aplicación compilada real, con sincronización determinista y sin esperas fijas. |

<!-- markdownlint-enable MD013 -->

La base actual solo prueba que `/health/ready` responde una vez iniciada la aplicación; no publica un estado de admisión
de tráfico. Por ello no sería correcto cambiar readiness a `503` durante el apagado sin definir antes su contrato de
deployment. El cierre del listener HTTP es implementable ahora y deja de aceptar conexiones nuevas; el draining
observable por readiness queda explícitamente para una unidad posterior con contrato de orquestador y recursos reales.

## Alcance y no objetivos

### Incluido

- Registrar un coordinador transversal de apagado y el namespace de configuración `shutdown`.
- Atender únicamente `SIGTERM` y `SIGINT` después de que `app.listen()` haya finalizado.
- Cerrar el listener y ejecutar los hooks de NestJS mediante `app.close(signal)`.
- Aplicar un único watchdog de plazo total, idempotencia para señales repetidas y limpieza de listeners.
- Emitir eventos de lifecycle seguros y cubrir el comportamiento con pruebas unitarias y de proceso.
- Cerrar la documentación owner, configuración operativa, pruebas y ambas baselines al completar la implementación
  verificada.

### Fuera de alcance

- Cambiar el contrato HTTP de `/health/live` o `/health/ready`, añadir draining/readiness state, probes de Kubernetes,
  Docker Compose o configuración de despliegue.
- Añadir recursos de dominio, persistencia, colas, clientes externos o hooks ficticios solo para probar el apagado.
- Atender `SIGHUP`, `SIGQUIT`, `SIGUSR2` u otras señales.
- Usar `process.exit(0)`, `useProcessExit`, métricas, trazas o un backend de observabilidad nuevo.
- Modificar en esta preparación `docs/plans/baseline-operational-completion*.md`, archivos de paquete, código fuente o
  el estado de OB-12.

## Arquitectura y contrato de responsables de recursos

### Ubicación y dependencias

`shutdown` es infraestructura transversal, no un Feature: su módulo y coordinador pertenecerán a `src/common/` y tendrán
un único módulo propietario. Su configuración pertenece a `src/config/`, donde ya viven los namespaces de bootstrap.
`AppModule` registrará una vez el namespace y el módulo; `main.ts` solo compondrá la aplicación ya iniciada con la
configuración tipada y el coordinador.

El coordinador no debe leer `process.env`, depender de controladores HTTP ni distribuir una API de cierre por los
Features. Debe recibir configuración tipada, el logger de aplicación y adaptadores mínimos de proceso/reloj/timer donde
esos límites mejoren la prueba. Las señales válidas se derivarán de una única constante runtime para evitar duplicar el
union type.

### Secuencia de cierre

1. `main.ts` crea la app, aplica el bootstrap compartido, y espera `app.listen()`.
2. Solo tras un `listen()` exitoso instala el coordinador para `SIGTERM` y `SIGINT`.
3. La primera señal se acepta como ganadora, marca el cierre como iniciado, instala el watchdog y emite
   `lifecycle.shutdown.started`. Este evento **solo** prueba la aceptación de la señal: no prueba que el listener ya
   esté cerrado ni habilita una aserción inmediata de rechazo de conexiones.
4. El coordinador llama una sola vez a `app.close(signal)`. En NestJS HTTP, ello prepara el cierre, ejecuta
   `OnModuleDestroy`, `BeforeApplicationShutdown`, dispone el adaptador HTTP y después ejecuta `OnApplicationShutdown`;
   el listener deja de aceptar trabajo como parte de `dispose()`. La implementación expondrá un boundary determinista de
   cierre del servidor si necesita afirmar antes de la terminación del child que ya no admite conexiones; en caso
   contrario, esa propiedad se prueba únicamente después de que `app.close()` complete o el child termine.
5. Si termina antes del plazo, se cancela el watchdog, se desinstalan los listeners, se emite
   `lifecycle.shutdown.completed` y se reemite **esa misma** señal con `process.kill(process.pid, signal)`. No se cambia
   el resultado de señal por un código cero.
6. Si `app.close()` rechaza antes del plazo, el latch terminal cancela el watchdog, desinstala los listeners y escribe
   una sola vez el evento crítico `shutdown.failed`; no reintenta `app.close()`, no ejecuta hooks de nuevo, no emite
   `completed` ni reemite la señal, y llama a `process.exit(1)`.
7. Si vence el plazo, el latch terminal escribe una vez el evento fatal `lifecycle.shutdown.timed_out` y fuerza
   `process.exit(1)`. No espera más hooks ni reemite la señal.

El plazo empieza al recibir la primera señal y no se reinicia entre hooks ni con señales repetidas. Un único latch
terminal arbitra timeout y rechazo: el primero que gana emite su único evento crítico; los callbacks tardíos no emiten
`completed`, `failed`, timeout ni reemiten una señal. La finalización de `app.close()` después de que venza el watchdog
no podrá emitir un evento de éxito ni reemitir una señal: el estado terminal del coordinador debe impedirlo.

### Contrato para proveedores actuales y futuros

Los proveedores que poseen recursos deben liberar exclusivamente sus propios recursos mediante los hooks lifecycle de
NestJS que correspondan; no deben instalar handlers de `process`, llamar a `process.exit()` ni cerrar recursos de otros
módulos. `app.close(signal)` es el único orquestador del orden de hooks. Los recursos futuros que necesiten dejar de
aceptar trabajo antes de liberar conexiones pueden implementar `BeforeApplicationShutdown`; su cleanup final puede vivir
en `OnModuleDestroy` o `OnApplicationShutdown` según el contrato de ese recurso. Cada responsable debe ser idempotente
porque el mismo cierre puede atravesar varias rutas de error, aunque el coordinador invoca `app.close()` una sola vez.

El hook de timeout no sustituye el cleanup cooperativo: es un límite de proceso para evitar una réplica bloqueada. No se
prometerá el cierre de un recurso que no alcance a completar antes del plazo.

### Fallo de startup

Mientras el bootstrap, la configuración o `listen()` fallen, no se instalarán handlers de señal. Si ya se creó la
aplicación, el boundary de startup intentará `app.close()` para liberar lo creado, preservará el error original (o un
`AggregateError` si también falla cleanup) y no emitirá eventos de apagado por señal. El coordinador solo es responsable
del runtime que ya escucha; no debe ocultar ni convertir el fallo de startup en una terminación satisfactoria.

## Configuración y observabilidad

### Namespace `shutdown`

La implementación añadirá `src/config/shutdown.config.ts` con una factory `registerAs('shutdown', ...)`, tipo readonly y
validación Zod del objeto final. La única entrada externa será:

<!-- markdownlint-disable MD013 -->

| Variable              | Predeterminado | Regla                                                                                                                                                         |
| --------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHUTDOWN_TIMEOUT_MS` |        `10000` | Entero positivo en milisegundos; valores ausentes usan el predeterminado y valores vacíos, no numéricos, fraccionarios o no positivos fallan durante startup. |

<!-- markdownlint-enable MD013 -->

El namespace no pertenece a `http`: el puerto y el proxy son configuración del servidor HTTP, mientras que este plazo
gobierna todo el lifecycle de proceso. `AppModule` lo cargará y el coordinador inyectará `shutdownConfig.KEY` con
`ConfigType<typeof shutdownConfig>`; no habrá lookups por strings ni revalidación en consumidores. El límite superior,
si se introduce, se justificará y documentará como política operativa; este plan no inventa uno.

La referencia operatoria de `SHUTDOWN_TIMEOUT_MS` pertenece al owner dedicado `docs/configuration/process-lifecycle.md`
y no a `docs/configuration/http-security.md`. `docs/architecture/configuration.md` registra el namespace `shutdown` y
enlaza brevemente al owner, sin repetir sus valores o reglas operativas.

### Eventos estructurados

Se extenderá el contrato mínimo `ApplicationLogger`, sus constantes y `StructuredLoggerService` con una API explícita
para lifecycle. Los mensajes estables y sus campos cerrados serán:

<!-- markdownlint-disable MD013 -->

| Evento                         | Nivel      | Campos permitidos      | Emisión                                                              |
| ------------------------------ | ---------- | ---------------------- | -------------------------------------------------------------------- |
| `lifecycle.shutdown.started`   | `log`      | `signal`, `timeoutMs`  | Una vez al aceptar la primera señal.                                 |
| `lifecycle.shutdown.completed` | `log`      | `signal`, `durationMs` | Una vez si `app.close()` termina antes del plazo.                    |
| `lifecycle.shutdown.timed_out` | `critical` | `signal`, `timeoutMs`  | Una vez, síncronamente, cuando vence el plazo.                       |
| `shutdown.failed`              | `critical` | `signal`, `timeoutMs`  | Una vez, síncronamente, si `app.close()` rechaza antes del deadline. |

<!-- markdownlint-enable MD013 -->

Los eventos normales de lifecycle continúan exclusivamente por `StructuredLoggerService`. Los dos resultados terminales
críticos usan un emergency sink propiedad del coordinador: una escritura síncrona, mínima y sin throws al descriptor de
error (por ejemplo, `fs.writeSync(2, line)`) antes de `process.exit(1)`. El sink serializa una línea estable con solo el
nombre del evento y los campos cerrados de la tabla; no recibe ni serializa el error de rechazo. El latch terminal es el
único emisor de ese sink, por lo que no se duplica el evento en `StructuredLoggerService` ni entre timeout y fallo. Un
fallo de la escritura se absorbe de forma segura: no retrasa ni impide la salida `1`.

`signal` solo puede ser `SIGTERM` o `SIGINT`; los valores numéricos son enteros no negativos donde aplique. No se
incluirán errores, stack, causes, PID, rutas, headers, variables de entorno, requests, recursos, secretos ni payloads.
La salida de `ConsoleLogger` sigue sin prometer JSON directamente parseable porque la configuración actual conserva
colores ANSI.

## Idempotencia y señales repetidas

El coordinador mantendrá un estado interno explícito (`running`, `closing`, `timed_out`, `failed`, `completed`) y la
promesa del primer cierre. Una primera `SIGTERM` o `SIGINT` gana; toda señal posterior mientras el estado sea `closing`
se ignora: no inicia otro `app.close()`, no reinicia el plazo, no emite eventos duplicados ni cambia la señal que se
reemitirá. Tras éxito, se retiran ambos listeners antes de reemitir la señal ganadora. Tras timeout, el proceso termina
con `1`; el latch protege el evento único incluso si se ejecutan callbacks tardíos.

Esta política es deliberadamente distinta de interpretar una segunda señal como salida inmediata: el requisito fija un
único plazo total y una única salida observable. Cualquier política de operador para abortar antes deberá ser una
decisión futura explícita.

## Evidencia técnica y límites

- La guía oficial de Nest describe que los hooks de shutdown se habilitan explícitamente y documenta el orden/límites de
  lifecycle: <https://docs.nestjs.com/fundamentals/lifecycle-events>.
- La documentación oficial de Node describe `process.on('SIGINT' | 'SIGTERM')`, la semántica de handlers de señal y
  `process.exit()`/códigos de salida: <https://nodejs.org/api/process.html#signal-events> y
  <https://nodejs.org/api/process.html#processexitcode>.
- La fuente local verificada de `@nestjs/core` 12.0.1 en `node_modules/@nestjs/core/nest-application-context.js`
  deduplica señales, ignora una segunda durante el cierre, ejecuta hooks/dispose y después usa
  `process.kill(process.pid, signal)` salvo que se active `useProcessExit`; ante error usa `process.exit(1)`. Su tipo
  local `ShutdownHooksOptions` confirma que `useProcessExit` cambiaría el resultado de señal a código cero.
- La fuente local `nest-application.js` confirma que el `dispose()` de la aplicación HTTP llama al cierre del adaptador.
  Las interfaces locales `BeforeApplicationShutdown` y `OnApplicationShutdown` aceptan la señal opcional.

La documentación web anterior se cita como autoridad, pero no se afirma aquí contenido de páginas dinámicas que no haya
sido recuperado durante esta preparación. El watchdog total requiere un coordinador propio: `enableShutdownHooks()` por
sí solo no expone una política de deadline alrededor de toda su secuencia.

## Plan estricto de TDD

Cada ciclo ejecuta primero la prueba enfocada que se está añadiendo. No se implementa una fase hasta observar el fallo
RED descrito; después de cada refactor se repite el conjunto enfocado verde.

### Fase 1 — RED: contrato de configuración y eventos

1. Añadir pruebas de `buildShutdownConfig()` para el default `10_000`, override válido y cada entrada inválida indicada
   en la tabla.
2. Añadir pruebas del logger para los eventos normales, sus niveles y la proyección exacta de metadata cuando se pasan
   campos sensibles o adicionales; añadir pruebas del emergency sink para los dos eventos terminales y sus líneas de
   campos fijos.
3. **Fallo esperado:** no existen factory, constantes ni métodos de logger de lifecycle; las pruebas fallan por
   imports/contratos ausentes.

### Fase 2 — GREEN: namespace y logger

1. Implementar la factory, schema, tipo readonly y registro `shutdown`; cargarlo una vez en `AppModule`.
2. Añadir las constantes, metadata types y métodos explícitos del contrato/servicio de logging.
3. Ejecutar las pruebas de configuración y logger hasta verde.

### Fase 3 — RED: coordinador de señal y deadline

1. Crear pruebas unitarias con proceso, clock/timer, app y logger controlados para la primera señal.
2. Fijar que `SIGTERM` y `SIGINT` llaman una sola vez a `app.close(signal)`, programan el timeout total, remueven
   listeners al éxito y reemiten la misma señal sin `useProcessExit` ni salida explícita cero.
3. Fijar que una segunda señal no duplica close, eventos o timer; fijar que una promesa de close pendiente al avanzar
   fake timers hasta el plazo escribe exactamente un evento crítico seguro y llama a `exit(1)` una vez.
4. Fijar que una resolución tardía después de timeout no produce `completed` ni `kill`, y que un rechazo antes del
   deadline cancela watchdog/listeners, escribe una sola vez `shutdown.failed` y llama a `exit(1)` sin reintentar hooks.
5. **Fallo esperado:** el coordinador no existe y los doubles no reciben estas interacciones.

### Fase 4 — GREEN: coordinador y bootstrap

1. Implementar el coordinador con dependencias mínimas, estado terminal y cancelación del watchdog.
2. Registrar su módulo/provider una vez y conectarlo desde `main.ts` únicamente después de `listen()`.
3. Añadir el boundary de startup que cierra una app parcialmente creada sin instalar listeners prematuros.
4. Ejecutar las pruebas unitarias enfocadas en verde.

### Fase 5 — TRIANGULATE: tiempos, fallos y plataforma

1. Usar fake timers de Vitest para comprobar límite exacto, cancelación antes de `10_000` ms, timeout, una sola emisión
   y resolución tardía; no usar tiempo real en unit tests.
2. Añadir casos de rechazo de `app.close()` antes del plazo: sin retry, emitir una sola vez el sink crítico
   `shutdown.failed` con sus campos fijos, cancelar watchdog/listeners y terminar `1`; no inventar una reemisión
   satisfactoria ni exponer el error.
3. Verificar `SIGTERM` y `SIGINT` por separado, y señales repetidas mezcladas; el primer valor debe permanecer
   autoritativo.
4. Añadir pruebas del bootstrap failure boundary para app creada/listen fallido y para fallo de cleanup, preservando el
   error original o el agregado.

### Fase 6 — integración de child process compilado

Crear `vitest.config.shutdown-process.ts` con discovery exclusivo de `test/shutdown/graceful-shutdown.process.test.ts`,
fuera de `**/*.spec.ts` y por tanto fuera de `pnpm test`. Añadir `pnpm run test:shutdown-process`, cuyo script ejecuta
primero `pnpm build` y luego ese config aislado. La suite ejecuta `node dist/main.js` con `PORT` obtenido mediante un
socket loopback efímero liberado justo antes del spawn y con un entorno mínimo no sensible.

- **Sincronización:** esperar el evento `spawn`, observar stdout/stderr y completar readiness mediante
  `GET /api/v1/health/live`; reintentar solo en respuesta a fallo de conexión con `setImmediate` y un deadline de
  prueba. No usar `sleep`, delays arbitrarios ni asumir que una línea de logger implica que el puerto ya acepta tráfico.
- **Éxito:** una vez que health responda, enviar `SIGTERM` y, en otro caso, `SIGINT`; esperar el evento `exit` del child
  y afirmar `code === null` y `signal` igual a la señal enviada. Confirmar en la salida los eventos `started` y
  `completed` con sus campos seguros, sin intentar parsear como JSON estricto.
- **Dejar de aceptar:** no intentar una conexión nueva inmediatamente después de `started`. Esperar la finalización de
  `app.close()` mediante una frontera determinista de cierre del servidor, si la implementación la expone, o el `exit`
  del child; solo entonces afirmar rechazo/cierre de una conexión nueva dentro del deadline del harness. No afirmar que
  una request ya en vuelo se cancela.
- **Solicitud incompleta:** iniciar una conexión TCP y esperar su callback `connect`; escribir headers HTTP válidos con
  `Content-Length` mayor que el cuerpo enviado y esperar el callback de `write` antes de enviar la señal. Esa barrera
  fija que el socket parcial fue establecido y sus bytes se entregaron al kernel antes de iniciar shutdown; el test no
  infiere que `started` haya cerrado el listener. La prueba compilada verifica que este caso real cierra correctamente
  sin timeout.
- **Timeout y fallo:** verificarlos en el seam unitario determinista del coordinador con fake timers y doubles
  controlados. Esta frontera se seleccionó después de observar Node 26: el servidor real cierra la conexión HTTP
  incompleta y no produjo una salida por timeout de proceso. No añadir un provider de producción artificial para
  bloquear el cierre ni afirmar evidencia de timeout a nivel de proceso.
- Todo child, socket y listener del harness se cerrará en `finally`; ante un fallo se recopilarán stdout, stderr y
  estado del child para diagnóstico sin imprimir environment values.

### Fase 7 — REFACTOR y cierre documental

1. Eliminar duplicación de doubles y factories de tests sin ocultar la política de señales.
2. Confirmar que `ApplicationLogger` conserva contratos de HTTP existentes y que los nuevos campos son cerrados.
3. Actualizar los documentos owner y las dos baselines solo después de que la implementación y las verificaciones estén
   verdes. La evidencia de OB-12 debe describir hechos implementados, no este plan.
4. Ejecutar de nuevo pruebas enfocadas y verificaciones finales después de cualquier refactor o formato.

## Restricciones de CI y plataforma

Las pruebas de señal y exit code son de proceso y requieren un runner Node que soporte `SIGTERM` y `SIGINT`; el proyecto
declara Node `>=26`. `test:shutdown-process` es un target POSIX obligatorio en CI POSIX soportado: cualquier fallo,
incluido que no se ejecute su config aislado, falla el job. En Windows, donde la entrega/semántica de señales es
limitada, la suite se marca explícitamente como skip por plataforma y conserva las pruebas unitarias fake-timer; no
finge cobertura equivalente ni oculta un fallo POSIX. No se usará `forceExit`: handles abiertos del harness son un fallo
que debe corregirse. La prueba debe reservar un puerto de loopback, no publicar interfaces externas, y tener su propio
deadline para evitar bloquear CI.

## Superficies de edición probables durante la implementación

La preparación actual solo crea este archivo. La implementación posterior deberá confirmar esta lista antes de
ampliarla:

```text
src/config/shutdown.config.ts
src/config/shutdown.config.spec.ts
src/common/shutdown/shutdown.module.ts
src/common/shutdown/shutdown-coordinator.service.ts
src/common/shutdown/shutdown-coordinator.service.spec.ts
src/common/observability/constants.ts
src/common/observability/logging/application-logger.ts
src/common/observability/logging/logger.service.ts
src/common/observability/logging/logger.service.spec.ts
src/common/observability/observability.module.ts
src/app.module.ts
src/main.ts
test/shutdown/graceful-shutdown.process.test.ts
    vitest.config.shutdown-process.ts
    package.json
docs/architecture/configuration.md
docs/architecture/observability.md
docs/configuration/process-lifecycle.md
docs/configuration/http-security.md
docs/testing/testing.md
docs/testing/e2e-testing.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

El script de `package.json` y la configuración Vitest aislada son necesarios para este target; los lockfiles y el estado
de las baselines no requieren cambios salvo que una verificación descubra una limitación real y se acuerde
explícitamente otro alcance.

## Verificación prevista

Ejecutar durante cada fase los targets enfocados nuevos y, tras el cierre de implementación, en este orden:

```bash
pnpm exec prettier --write <archivos-modificados>
pnpm lint-staged
pnpm run test:shutdown-process
pnpm test
pnpm run test:e2e
pnpm lint
pnpm build
pnpm exec prettier --check .
pnpm run lint:md
```

`pnpm run test:shutdown-process` construye antes de ejecutar su configuración aislada y debe correr antes de
`pnpm test`; no se incorporará la prueba al discovery normal. Antes del review se repetirá `pnpm lint-staged` hasta que
no modifique contenido, conforme a `AGENTS.md`.

Para esta preparación documental se ejecutan únicamente:

```bash
pnpm exec prettier --write docs/plans/shutdown/graceful-shutdown.md
pnpm exec markdownlint-cli2 docs/plans/shutdown/graceful-shutdown.md
git diff --no-index --check /dev/null docs/plans/shutdown/graceful-shutdown.md || test $? -eq 1
```

## Rollback

Revertir la unidad de implementación completa —coordinador, configuración, pruebas y documentación evidencial— si el
cierre causa regresiones. No dejar un namespace registrado sin consumidor, handlers parciales ni una baseline marcada
completa. El rollback de esta preparación elimina únicamente este plan; no cambia el estado pendiente de OB-12.

## Criterios de aceptación para la implementación

- [ ] Solo `SIGTERM` y `SIGINT` inician el apagado después de un `listen()` exitoso.
- [ ] `lifecycle.shutdown.started` significa únicamente que la primera señal fue aceptada; la falta de admisión se
      prueba solo tras `app.close()`/terminación del child o mediante un boundary de cierre de servidor determinista.
- [ ] La primera señal detiene la admisión HTTP mediante `app.close(signal)` y ejecuta los hooks de Nest dentro de un
      plazo total configurable de `10_000` ms por defecto.
- [ ] `SHUTDOWN_TIMEOUT_MS` se valida en un namespace tipado, readonly y de ownership explícito, con su referencia
      operatoria en el owner de lifecycle de proceso.
- [ ] Un cierre exitoso remueve listeners y reemite la señal original; no usa `useProcessExit` ni cambia el resultado a
      salida cero.
- [ ] Señales repetidas no duplican cierre, timer, eventos ni cambian la señal ganadora.
- [ ] Un timeout emite exactamente una vez `lifecycle.shutdown.timed_out` mediante el emergency sink síncrono,
      únicamente con `signal` y `timeoutMs`, antes de forzar código de salida `1`.
- [ ] Un rechazo de `app.close()` no reintenta hooks, cancela watchdog y listeners, emite exactamente una vez
      `shutdown.failed` por el emergency sink y sale con código `1`.
- [ ] Los eventos `started` y `completed` usan `StructuredLoggerService`; los eventos críticos tienen nombres estables,
      campos cerrados y no exponen datos sensibles ni se duplican.
- [ ] El fallo de startup limpia una app ya creada sin instalar handlers de runtime ni ocultar el error.
- [ ] Unit tests con fake timers cubren éxito, timeout, resolución tardía, error y señales repetidas.
- [ ] `pnpm run test:shutdown-process` construye y ejecuta la integración POSIX aislada fuera de `pnpm test`; usa
      sincronización determinista de socket parcial, declara skip solo en Windows y falla en CI POSIX ante cualquier
      error.
- [x] La integración arranca la app real en child process, usa sincronización determinista sin sleeps y verifica ambas
      señales, detención de admisión y cierre correcto con una solicitud incompleta real.
- [x] Los unit tests deterministas del coordinador verifican watchdog timeout, completación tardía y fallo; no se afirma
      una salida por timeout a nivel de proceso.
- [ ] Readiness draining permanece documentado como diferido, no implementado implícitamente.
- [x] Documentos owner, ambas baselines y evidencia se actualizan tras las verificaciones de implementación registradas.
- [ ] Formato, Markdown lint, pruebas, lint y build pasan en las plataformas aplicables; no se realiza commit,
      publicación ni despliegue.
