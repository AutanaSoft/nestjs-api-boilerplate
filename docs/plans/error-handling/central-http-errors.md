# Plan de implementación de errores HTTP centrales

Este plan define cómo completar **OB-10** mediante un único Error Boundary HTTP que traduzca errores esperados, errores
del framework y fallos desconocidos al contrato público compartido, reutilizando la correlación y los logs estructurados
de OB-11.

## Resultado esperado

Al finalizar, toda respuesta HTTP de error deberá utilizar la forma
`{ statusCode, code, message, requestId, details? }`. La traducción deberá ocurrir en un filtro global, los errores de
aplicación deberán permanecer independientes de HTTP y los fallos inesperados deberán registrarse con contexto seguro
sin exponer información técnica al cliente.

## Alcance

### Incluido

- Definir la representación canónica y reutilizable de `ErrorResponse`.
- Definir una abstracción mínima para condiciones esperadas de aplicación, independiente del transporte.
- Centralizar la traducción de errores mediante un Exception Filter global.
- Traducir excepciones HTTP conocidas de NestJS sin propagar cuerpos arbitrarios.
- Traducir errores esperados de aplicación mediante un catálogo explícito.
- Convertir errores desconocidos y fallos de contratos de salida en respuestas `500` seguras.
- Incorporar el `requestId` administrado por `RequestContextService` al cuerpo de error.
- Registrar errores inesperados mediante el logger estructurado y correlacionado de OB-11.
- Cubrir clasificación, traducción, seguridad, registro global y comportamiento HTTP real.
- Actualizar los documentos owner y la evidencia del baseline una vez verificada la implementación.

### Fuera de alcance

- Implementar Request validation o `StandardSchemaValidationPipe`, pertenecientes a OB-08.
- Implementar Response serialization o `StandardSchemaSerializerInterceptor`, pertenecientes a OB-09.
- Definir esquemas de Request o Response específicos de futuros módulos de negocio.
- Configurar Swagger/OpenAPI, perteneciente a OB-07.
- Diseñar errores de dominio para módulos de negocio todavía inexistentes.
- Exponer stacks, causas, payloads, respuestas de proveedores o detalles tecnológicos.
- Incorporar métricas o trazas, diferidas en OB-14.
- Cambiar la política de correlación y adopción de `X-Request-Id` definida por OB-11.

## Dependencias y documentos owner

La implementación debe respetar:

- [Manejo de errores](../../architecture/error-handling.md): separación entre errores de aplicación, errores
  tecnológicos y representación HTTP.
- [Contratos HTTP](../../api/http-contracts.md): forma y restricciones del Error Response público.
- [Convenciones de API](../../api/conventions.md): semántica de HTTP Status Codes.
- [Observabilidad](../../architecture/observability.md): correlación, logging estructurado y protección de datos
  sensibles.
- [Validación](../../architecture/validation.md): integración posterior de OB-08 con el Error Boundary.
- [Serialización](../../architecture/serialization.md): tratamiento de fallos de salida como errores internos.
- [Pruebas](../../testing/testing.md) y [pruebas E2E](../../testing/e2e-testing.md): niveles, aislamiento y verificación
  por HTTP real.
- [Baseline operacional](../baseline-operational-completion.md): dependencias y evidencia requerida para completar
  OB-10.

OB-11 ya proporciona `RequestContextService`, `APP_LOGGER`, `StructuredLoggerService`, propagación de `X-Request-Id` y
logging terminal. OB-10 debe consumir esas capacidades sin crear un segundo contexto o backend de logging.

## Decisiones de implementación

Las decisiones requeridas para OB-10 están resueltas. Antes de consolidar las APIs internas, la primera fase debe
trasladarlas a los documentos owner correspondientes y verificar que no exista una contradicción con los contratos
vigentes.

<!-- markdownlint-disable MD013 -->

| Decisión              | Decisión adoptada                                                                                                                                                         | Criterio de aceptación                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Taxonomía inicial     | **Resuelta:** usar una clase base abstracta `ApplicationError` que extienda `Error`, con `code` perteneciente a una unión cerrada y subclases con contexto interno tipado | Los servicios permanecen independientes de NestJS y HTTP; las subclases no contienen status ni mensajes públicos, y `cause` nunca cruza el boundary.                                                  |
| Mapping a HTTP        | **Resuelta:** usar un catálogo tipado e inmutable que satisfaga `Record<ApplicationErrorCode, HttpErrorDescriptor>`                                                       | La cobertura es exhaustiva; status y mensajes públicos permanecen en el boundary, y `details` requiere un proyector explícito y tipado por código.                                                    |
| Excepciones de NestJS | **Resuelta:** traducir solo casos reconocidos mediante una lista permitida y reconstruir siempre el Error Response                                                        | `exception.getResponse()` nunca se propaga; routing usa `ROUTE_NOT_FOUND`, throttling usa `RATE_LIMIT_EXCEEDED` y los casos no confiables caen a `INTERNAL_SERVER_ERROR`.                             |
| Códigos iniciales     | **Resuelta:** definir un catálogo completo para los status permitidos `400`, `401`, `403`, `404`, `409`, `429` y `500`                                                    | Los códigos usan `UPPER_SNAKE_CASE`, tienen significado único, distinguen ruta de recurso y no dependen de textos de NestJS; los fallbacks genéricos no sustituyen códigos de aplicación específicos. |
| Política de `details` | **Resuelta:** omitir por defecto y permitirlo solo mediante proyectores explícitos con contratos públicos tipados por código                                              | Nunca se serializa el error original ni un valor `unknown`; si la proyección falla, se omite `details` sin alterar la respuesta.                                                                      |
| Registro global       | **Resuelta:** crear un `ErrorHandlingModule` transversal y registrar `HttpExceptionFilter` mediante `APP_FILTER`                                                          | `AppModule` lo importa una sola vez; NestJS resuelve sus dependencias por DI y producción/E2E comparten el registro sin construcción manual.                                                          |
| Logging inesperado    | **Resuelta:** añadir `logUnexpectedHttpError()` con evento estable `http.request.failed` y metadata cerrada                                                               | Incluye método, ruta normalizada, tipo seguro y correlación; excluye mensajes variables, stack, cause, body, query y headers, y solo se emite para fallos internos.                                   |
| Ausencia de contexto  | **Resuelta:** generar localmente un UUID v4 con `node:crypto.randomUUID()`                                                                                                | Header, body y log usan el mismo valor; `requestIdFallback: true` solo aparece en metadata interna y nunca se confía en el header entrante.                                                           |
| Fallos de salida      | **Resuelta:** responder con `500`, `INTERNAL_SERVER_ERROR`, mensaje seguro y sin `details`; clasificar internamente como `ResponseContractViolation`                      | OB-09 emitirá un error interno reconocible sin semántica HTTP; no se registran respuestas completas ni valores inválidos.                                                                             |

<!-- markdownlint-enable MD013 -->

Si durante la implementación aparece una contradicción o resulta necesario modificar una decisión, debe detenerse ese
frente y actualizar primero el documento owner correspondiente.

## Diseño propuesto

### Flujo de traducción

```text
ApplicationError ───────────────┐
HttpException ──────────────────┼─> HttpExceptionFilter
Unknown / response failure ─────┘          │
                                            ├─> ErrorResponse público
                                            └─> diagnóstico interno seguro
```

El filtro debe clasificar el valor capturado como `unknown`, seleccionar una traducción conocida y construir una
respuesta nueva. No debe reutilizar directamente el body de una excepción ni inspeccionar propiedades antes de realizar
narrowing.

### Estructura de archivos prevista

Los nombres de archivos, carpetas, símbolos, códigos y eventos se mantienen en inglés.

```text
src/common/error-handling/
├── application-error.ts
├── application-error.spec.ts
├── error-response.ts
├── error-response.spec.ts
├── http-error-mapping.ts
├── http-error-mapping.spec.ts
├── http-exception.filter.ts
└── http-exception.filter.spec.ts
```

Archivos existentes que previsiblemente deberán modificarse:

```text
src/app.module.ts
src/common/observability/logging/application-logger.ts
src/common/observability/logging/logger.service.ts
src/common/observability/logging/logger.service.spec.ts
test/modules/health/health.e2e-suite.ts
test/support/e2e-rate-limit.controller.ts
docs/architecture/error-handling.md
docs/api/http-contracts.md
docs/architecture/observability.md
docs/plans/baseline-operational-completion.md
docs/plans/baseline-operational-completion.es.md
```

La lista es una previsión. La implementación deberá confirmar si el fixture de rate limit es suficiente o si necesita
una ruta E2E exclusiva para provocar un fallo inesperado. Cualquier ampliación debe justificarse antes de modificar
archivos fuera de este alcance.

### Responsabilidades

#### `ApplicationError`

- Representar únicamente condiciones esperadas con significado para la aplicación.
- Exponer un discriminante o `code` estable y los datos mínimos requeridos para clasificar el error.
- Mantener fuera de la abstracción los status HTTP, objetos Request/Response y clases de NestJS.
- Preservar la causa solo para diagnóstico interno cuando resulte necesario; nunca hacerla pública.

#### `ErrorResponse`

- Ser el owner de implementación de la forma pública compartida.
- Modelar `details` como opcional y validarlo mediante una política explícita, no como propagación libre de `unknown`.
- Mantener alineados tipo, constructor y futuro schema canónico para OpenAPI.
- Garantizar que `requestId` siempre sea un string válido conforme a la política de correlación.

#### `http-error-mapping`

- Clasificar errores esperados mediante un mapping exhaustivo.
- Reconocer únicamente excepciones HTTP del framework que tengan una traducción pública aprobada.
- Asignar status, código, mensaje público y constructor opcional de `details`.
- Aplicar una traducción interna segura a todo valor desconocido.
- Mantener pura la selección de la representación para facilitar pruebas unitarias.

#### `HttpExceptionFilter`

- Capturar errores globalmente y tratarlos inicialmente como `unknown`.
- Obtener el `requestId` desde `RequestContextService` o aplicar el fallback aprobado.
- Construir y emitir un `ErrorResponse` nuevo.
- Mantener sincronizados el status de la respuesta, `body.statusCode` y el evento terminal existente.
- Registrar los fallos inesperados con metadata permitida y correlacionada.
- No registrar ni devolver bodies, query strings, credenciales, cookies, headers sensibles o stacks.

#### `ApplicationLogger`

- Exponer solo la operación mínima necesaria para errores inesperados.
- Aceptar mensajes estables y metadata estructurada mediante un contrato propio.
- Adjuntar el `requestId` desde la infraestructura existente.
- Evitar que el filtro conozca `ConsoleLogger` o detalles del backend.

#### Registro transversal

- Registrar un único filtro para toda la aplicación.
- Preferir composición mediante DI para reutilizar exactamente el mismo registro en producción y E2E.
- Evitar registro duplicado entre `main.ts`, `setupApplication()` y el helper E2E.
- Mantener `setupApplication()` como owner del setup imperativo ya existente, sin trasladar allí providers que requieran
  DI salvo necesidad demostrada.

## Secuencia de implementación

La ejecución seguirá ciclos **RED, GREEN, TRIANGULATE y REFACTOR**. Cada fase debe conservar en verde las pruebas de las
fases anteriores.

### Fase 1 — Formalizar los contratos aprobados

1. Trasladar la taxonomía abstracta de errores y la separación del mapping a `error-handling.md`.
2. Registrar el catálogo público completo, los mensajes, la política de `details` y el tratamiento de fallos de salida
   en `http-contracts.md`.
3. Registrar `http.request.failed`, su metadata cerrada y la anomalía de fallback en `observability.md`.
4. Documentar el registro mediante `APP_FILTER` y la responsabilidad de `ErrorHandlingModule` en el owner arquitectónico
   apropiado.
5. Verificar que los códigos aprobados cubren `400`, `401`, `403`, `404`, `409`, `429` y `500`, y que distinguen ruta de
   recurso.
6. Confirmar el fixture E2E exclusivo de pruebas que provocará el error desconocido.

**Salida:** decisiones aprobadas reflejadas en sus owners antes de crear APIs internas estables.

### Fase 2 — Definir errores de aplicación independientes del transporte

1. **RED:** escribir pruebas para construcción, discriminación y preservación de datos mínimos.
2. **GREEN:** implementar la abstracción mínima de `ApplicationError`.
3. **TRIANGULATE:** añadir al menos dos códigos esperados con datos distintos para evitar un diseño accidentalmente
   específico.
4. **REFACTOR:** eliminar cualquier dependencia de NestJS, Express o HTTP.

**Salida:** los servicios futuros podrán expresar condiciones esperadas sin conocer su representación HTTP.

### Fase 3 — Construir la respuesta pública y el mapping

1. **RED:** probar traducciones para `404`, `429`, un error esperado y un valor desconocido.
2. **RED:** probar que mensajes técnicos, stacks, causas y cuerpos arbitrarios no aparecen en la respuesta.
3. **GREEN:** implementar el constructor de `ErrorResponse` y el mapping aprobado.
4. **TRIANGULATE:** cubrir excepciones de NestJS con body string, body object y contenido no permitido.
5. **TRIANGULATE:** cubrir inclusión y omisión de `details` según la lista permitida.
6. **REFACTOR:** mantener pura y exhaustiva la clasificación; no mezclar escritura HTTP ni logging.

**Salida:** una traducción determinista y segura independiente del adaptador HTTP.

### Fase 4 — Implementar el filtro global

1. **RED:** probar status, headers y body emitidos por el filtro con un `requestId` existente.
2. **RED:** probar el comportamiento aprobado cuando el contexto no contiene `requestId`.
3. **GREEN:** implementar `HttpExceptionFilter` e inyectar contexto y logger mediante contratos propios.
4. **TRIANGULATE:** cubrir errores esperados, `HttpException` permitida y error desconocido.
5. **TRIANGULATE:** verificar igualdad entre el header `X-Request-Id` y `body.requestId`.
6. **REFACTOR:** mantener las APIs de Express y NestJS confinadas al filtro.

**Salida:** el boundary puede producir respuestas completas sin depender de controllers concretos.

### Fase 5 — Integrar logging y registro transversal

1. **RED:** ampliar las pruebas de `ApplicationLogger` para la operación de error acordada.
2. **RED:** demostrar que un error esperado no produce diagnóstico de fallo inesperado.
3. **RED:** demostrar que un error desconocido produce un único evento seguro y correlacionado.
4. **GREEN:** ampliar `ApplicationLogger` y `StructuredLoggerService` con la operación mínima.
5. **GREEN:** registrar el filtro una sola vez mediante el mecanismo aprobado.
6. **TRIANGULATE:** comprobar que el middleware terminal conserva el status final y no duplica eventos.
7. **REFACTOR:** eliminar acoplamientos al backend y listas de metadata duplicadas.

**Salida:** producción y E2E comparten un único Error Boundary con diagnóstico interno seguro.

### Fase 6 — Verificar el contrato por HTTP real

Extender la suite E2E para demostrar que:

1. una ruta inexistente devuelve el Error Response uniforme con status `404` y código estable;
2. throttling devuelve la misma forma con status `429` y no filtra el body interno del framework;
3. un error esperado controlado utiliza su mapping aprobado;
4. un error desconocido devuelve `500` con mensaje seguro y sin stack, causa o detalles internos;
5. `X-Request-Id` coincide con `body.requestId` en todos los casos;
6. un identificador válido enviado por el cliente se conserva en header y body;
7. un identificador ausente o inválido se reemplaza conforme a OB-11;
8. los logs inesperados contienen correlación y campos permitidos, sin payloads sensibles;
9. el evento terminal `http.request.completed` conserva el status real de la respuesta.

Los endpoints de prueba deberán existir únicamente en el entorno E2E y no ampliar la API publicada de producción.

**Salida:** evidencia del contrato sobre la aplicación real y el pipeline compartido.

### Fase 7 — Cerrar evidencia y documentación

1. Ejecutar pruebas enfocadas durante cada ciclo TDD.
2. Ejecutar el flujo de `lint-staged` sobre los archivos previstos hasta que una segunda ejecución no produzca cambios.
3. Ejecutar la verificación completa del repositorio.
4. Actualizar los documentos owner con las decisiones finales y referencias a la implementación.
5. Actualizar ambas versiones de `baseline-operational-completion` con estado, evidencia, dependencias y aceptación
   equivalentes.
6. Marcar OB-10 como completa únicamente cuando la implementación y todas las verificaciones sean reproducibles.

**Salida:** OB-10 completa con evidencia sincronizada y OB-08/OB-09 formalmente desbloqueadas.

## Estrategia de pruebas

<!-- markdownlint-disable MD013 -->

| Nivel                 | Objetivo              | Evidencia principal                                                          |
| --------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Unitario              | Errores de aplicación | Independencia del transporte, discriminación y datos mínimos.                |
| Unitario              | Mapping público       | Status, códigos, mensajes, `details` permitidos y fallback interno.          |
| Unitario              | Seguridad             | Exclusión de stacks, causas, cuerpos arbitrarios y datos tecnológicos.       |
| Unitario              | Filtro HTTP           | Escritura de status, header, body, correlación y logging selectivo.          |
| Unitario              | Logger                | Evento inesperado estable, metadata permitida y `requestId`.                 |
| Integración de módulo | Registro global       | Un único provider global con dependencias resueltas por DI.                  |
| E2E                   | Contrato HTTP real    | `404`, `429`, error esperado, `500`, header/body y ausencia de filtraciones. |

<!-- markdownlint-enable MD013 -->

Las pruebas unitarias del mapping no deben iniciar una aplicación NestJS. Las pruebas E2E no deben reemplazar el filtro,
el contexto, el logger ni el throttler: deben recorrer el pipeline real. Los dobles solo podrán controlar la condición
que provoca el error y la captura del backend externo de logging cuando sea necesario observar su salida.

## Comandos de verificación

Durante TDD deben ejecutarse primero las pruebas enfocadas de cada archivo. Antes de iniciar la revisión RDD, se
aplicará el flujo configurado de `lint-staged` al conjunto previsto hasta obtener una segunda ejecución sin cambios.
Después se ejecutará, como mínimo:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm lint:md
pnpm build
```

Prettier debe ejecutarse sobre cada Markdown editado antes de `markdownlint-cli2`. No debe utilizarse un formateo global
que modifique archivos ajenos al alcance.

## Riesgos y mitigaciones

<!-- markdownlint-disable MD013 -->

| Riesgo                                               | Mitigación                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Propagar directamente cuerpos de `HttpException`     | Reconstruir siempre la respuesta desde un mapping y una lista permitida.                   |
| Acoplar servicios a HTTP                             | Mantener status y representación exclusivamente en el boundary.                            |
| Filtrar stacks, causas o secretos                    | Tratar el error como `unknown`, separar diagnóstico interno y probar exclusiones.          |
| Convertir `details` en un escape sin contrato        | Omitir por defecto y habilitar constructores explícitos por código.                        |
| Perder el `requestId`                                | Consumir `RequestContextService`, definir fallback y afirmar igualdad entre header y body. |
| Duplicar filtros o logs                              | Registrar un único provider global y probar un solo evento inesperado y uno terminal.      |
| Alterar respuestas exitosas                          | Limitar el filtro al flujo de excepciones y mantener pruebas existentes en verde.          |
| Clasificar un fallo de salida como error del cliente | Reservar una traducción interna `500` para integración futura con OB-09.                   |
| Fijar códigos alrededor de textos de NestJS          | Definir códigos propios estables y probar independencia del mensaje del framework.         |
| Crear endpoints de diagnóstico en producción         | Mantener fixtures de error exclusivamente dentro del módulo E2E.                           |
| Divergir entre documentación e implementación        | Actualizar owners primero y cerrar el baseline solo después de verificar.                  |

<!-- markdownlint-enable MD013 -->

## Criterios de aceptación

- [ ] Existe un único Error Boundary HTTP global compartido por producción y E2E.
- [ ] Toda respuesta HTTP de error usa `{ statusCode, code, message, requestId, details? }`.
- [ ] `statusCode` coincide con el status HTTP enviado.
- [ ] `code` es estable, machine-readable e independiente del texto del framework.
- [ ] `message` es seguro y no constituye el identificador programático del error.
- [ ] `details` se omite por defecto y solo contiene estructuras públicas aprobadas.
- [ ] `body.requestId` coincide con el header `X-Request-Id`.
- [ ] Los errores esperados de aplicación no dependen de NestJS, Express ni HTTP.
- [ ] Los controllers no repiten mappings centralizables.
- [ ] Los cuerpos arbitrarios de `HttpException` no se propagan directamente.
- [ ] Los errores desconocidos producen `500` sin exponer stack, causa o información tecnológica.
- [ ] Los fallos futuros de Response contracts se clasifican como errores internos.
- [ ] Los fallos inesperados generan diagnóstico interno seguro, estructurado y correlacionado.
- [ ] Los errores esperados no generan ruido de diagnóstico inesperado.
- [ ] Las pruebas cubren `404`, `429`, un error esperado y un error desconocido.
- [ ] El registro del filtro no altera health checks, throttling, CORS, versioning ni logs terminales.
- [ ] Producción y E2E utilizan el mismo registro transversal.
- [ ] Prettier, lint de TypeScript y Markdown, pruebas unitarias, E2E y build finalizan correctamente.
- [ ] Los documentos owner y ambas listas del baseline contienen evidencia sincronizada.

## Siguiente paso

Una vez completada OB-10, implementar **OB-08 — Request validation** para hacer converger sus errores controlados en
este boundary. OB-09 podrá reutilizar la misma traducción interna para fallos de contratos de salida. OB-07 deberá
documentar los códigos y schemas públicos resultantes sin duplicar su ownership.
