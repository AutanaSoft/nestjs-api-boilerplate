# Propuesta: establecer una base extensible de pruebas E2E

## Intención

Establecer una base E2E extensible para la API NestJS que conserve el comportamiento HTTP real de la
aplicación, haga explícita la propiedad del ciclo de vida y muestre cómo registrar y organizar
futuras suites de funcionalidad sin introducir capacidades ficticias.

## Problema

La suite actual valida correctamente el límite HTTP mediante `AppModule`, `setupApplication`, Vitest
y Supertest, pero su estructura no ofrece una convención segura para crecer. `vitest.config.e2e.ts`
descubre todos los archivos `**/*.e2e-spec.ts`; por ello, una futura suite importada con el mismo
sufijo podría ejecutarse también como punto de entrada independiente. Además, la suite existente
concentra registro, bootstrap, mutación del entorno y desmontaje sin separar las responsabilidades
reutilizables.

Esta situación aumenta el riesgo de ejecución duplicada, propietarios de ciclo de vida en conflicto
y convenciones ad hoc cuando se incorporen funcionalidades que requieran persistencia, autenticación
o proveedores externos. La documentación también presenta una inconsistencia: `openspec/config.yaml`
identifica Playwright como ejecutor E2E, aunque el repositorio usa Vitest.

## Resultado propuesto

El proyecto contará con un único punto de entrada E2E descubierto por Vitest, responsable del ciclo
de vida, que registre suites de funcionalidad importadas y no descubribles. Los escenarios
independientes crearán una aplicación Nest nueva, preservando el aislamiento actual —incluido el
estado del límite de tasa— y reutilizarán un bootstrap derivado de producción.

La estructura resultante servirá como ejemplo ejecutable de registro y organización para futuras
suites. Las extensiones previstas para base de datos, autenticación y proveedores externos se
documentarán como pautas futuras, sin interfaces vacías, infraestructura simulada ni abstracciones
anticipadas.

## Alcance

### Incluido

- Restringir el descubrimiento de Vitest al propietario principal `test/main.e2e-spec.ts`.
- Organizar las cuatro comprobaciones HTTP existentes como una suite de funcionalidad importada
  mediante un nombre o ruta que Vitest no descubra directamente.
- Mostrar de forma concreta cómo el propietario principal registra suites futuras en un orden
  explícito.
- Introducir únicamente soporte requerido por el comportamiento actual:
  - un contexto E2E tipado con la aplicación Nest inicializada;
  - un creador de aplicación basado en `AppModule`, la configuración tipada `http` y
    `setupApplication`;
  - manejo acotado del estado de entorno modificado por E2E, con captura y restauración incluso ante
    fallos parciales.
- Crear y cerrar una aplicación Nest nueva por cada escenario independiente.
- Mantener las aserciones públicas existentes para respuesta raíz, cabeceras de Helmet, CORS,
  preflight y límite de tasa.
- Corregir en `openspec/config.yaml` los metadatos E2E de Playwright a Vitest, incluido el comando
  existente `pnpm run test:e2e`.
- Actualizar `docs/testing/e2e-testing.md` con la convención concreta resultante de descubrimiento,
  nomenclatura, registro, aislamiento por escenario y puntos de extensión futuros.

### Fuera de alcance

- Incorporar PostgreSQL, Prisma, migraciones, autenticación, nuevas funcionalidades de dominio,
  fixtures o seeds.
- Crear interfaces vacías, adaptadores falsos, dobles sin un límite externo real o infraestructura
  preparatoria para capacidades todavía inexistentes.
- Introducir Jest o Playwright.
- Crear un módulo Nest exclusivo para pruebas o sustituir componentes internos de la aplicación.
- Cambiar contratos HTTP públicos, configuración de producción o comportamiento del throttling.
- Diseñar propietarios E2E adicionales o ejecución concurrente antes de que exista un caso aislado
  que lo justifique.

## Reglas y límites

1. `test/main.e2e-spec.ts` será el único punto de entrada E2E descubierto en este primer alcance.
2. Las suites importadas registrarán escenarios, pero no poseerán hooks que creen aplicaciones,
   muten `process.env` o liberen recursos globales.
3. Cada escenario independiente recibirá una aplicación nueva y cerrará sus recursos de forma
   determinista.
4. El bootstrap E2E conservará `AppModule` y `setupApplication` para representar el comportamiento
   HTTP de producción.
5. Los escenarios permanecerán seguros al reordenarse; un futuro flujo secuencial deberá declarar su
   estado mediante un contexto tipado propio de la funcionalidad.
6. Las capacidades futuras se expresarán mediante documentación y ejemplos de organización o
   registro, no mediante implementaciones simuladas.
7. Cuando existan persistencia, autenticación o proveedores externos, la ampliación deberá mantener
   reales los componentes internos y aislar solamente recursos o límites fuera de proceso que lo
   requieran.

## Áreas afectadas

| Área                     | Cambio esperado                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Configuración E2E        | Descubrimiento exclusivo de `test/main.e2e-spec.ts` en `vitest.config.e2e.ts`.                          |
| Organización de pruebas  | Propietario principal, suite de aplicación importada y soporte mínimo de contexto, bootstrap y entorno. |
| Cobertura existente      | Reubicación de los cuatro escenarios actuales sin alterar su intención ni su contrato observable.       |
| OpenSpec                 | Corrección de los metadatos de Playwright a Vitest en `openspec/config.yaml`.                           |
| Documentación de testing | Convención concreta y puntos de extensión futuros en `docs/testing/e2e-testing.md`.                     |

## Puntos de extensión futuros

Estos puntos son directrices documentales y no entregables de infraestructura en este cambio:

- **PostgreSQL y Prisma:** el propietario principal deberá crear una base temporal exclusiva de E2E,
  validar de forma segura su configuración administrativa, aplicar migraciones versionadas y
  eliminar los recursos al finalizar.
- **Autenticación:** los escenarios deberán obtener credenciales mediante los flujos HTTP públicos
  de registro o inicio de sesión, sin tokens preemitidos que omitan el comportamiento probado.
- **Proveedores externos:** solo podrá sustituirse el adaptador enlazado por DI que cruce el límite
  fuera de proceso; controladores, guards, servicios, repositorios y persistencia permanecerán
  reales.
- **Fixtures y seeds:** se priorizará la creación mediante HTTP; los seeds directos se reservarán
  para prerrequisitos mínimos y documentados que no puedan o no deban producirse razonablemente por
  la API.

## Riesgos y mitigaciones

| Riesgo                                                                   | Mitigación                                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Filtración del estado del límite de tasa entre escenarios                | Mantener una aplicación nueva por escenario independiente.                                                                       |
| Ejecución duplicada de suites importadas                                 | Descubrir únicamente `test/main.e2e-spec.ts` y reservar una nomenclatura no descubrible para las suites registradas.             |
| Fuga de recursos o de valores de `process.env` ante errores              | Capturar antes de mutar, cerrar recursos parciales y restaurar el entorno en rutas normales y de fallo.                          |
| Abstracciones prematuras para capacidades futuras                        | Limitar este cambio al soporte exigido por las pruebas actuales y documentar las extensiones sin implementarlas.                 |
| Divergencia entre documentación y ejecución real                         | Alinear `openspec/config.yaml`, `docs/testing/e2e-testing.md`, `vitest.config.e2e.ts` y `pnpm run test:e2e`.                     |
| El propietario único se interpreta como una aplicación global compartida | Documentar que la propiedad del ciclo de vida no impide crear una aplicación nueva por escenario cuando el aislamiento lo exige. |

## Rollback

Si la nueva organización causa regresiones, se podrá restaurar el descubrimiento anterior de
`**/*.e2e-spec.ts` y devolver los cuatro escenarios a `test/app.e2e-spec.ts`, eliminando únicamente
los archivos de soporte introducidos por este cambio. La corrección documental de Playwright a
Vitest no deberá revertirse mientras Vitest continúe siendo el ejecutor real del repositorio.

El rollback no requiere cambios de datos, migraciones ni compatibilidad de API porque esta propuesta
no modifica persistencia ni contratos públicos.

## Criterios de éxito

- `pnpm run test:e2e` descubre un único propietario de ciclo de vida y ejecuta una sola vez los
  cuatro escenarios existentes.
- Cada escenario independiente utiliza una aplicación Nest recién creada y todos los recursos se
  cierran sin depender de terminación forzada.
- Las pruebas continúan ejercitando `AppModule`, `setupApplication` y el servidor HTTP real mediante
  Supertest.
- Una suite de funcionalidad importada demuestra el patrón de registro y no coincide con el patrón
  de descubrimiento de Vitest.
- El estado de entorno modificado por E2E se restaura tanto después de una ejecución correcta como
  ante un fallo parcial de configuración.
- `openspec/config.yaml` identifica Vitest y `pnpm run test:e2e` como ejecutor y comando E2E.
- `docs/testing/e2e-testing.md` describe la convención concreta resultante y diferencia claramente
  las extensiones futuras de las capacidades implementadas.
- No se agregan dependencias, interfaces vacías, infraestructura falsa ni abstracciones para base de
  datos, autenticación o proveedores externos.

## Evidencia y restricciones de la propuesta

La propuesta se basa exclusivamente en evidencia local del repositorio, principalmente
`openspec/changes/establish-e2e-test-foundation/explore.md`, `test/app.e2e-spec.ts`,
`vitest.config.e2e.ts`, `docs/testing/e2e-testing.md` y `openspec/config.yaml`. No se realizó
investigación externa. La implementación, las especificaciones, el diseño y las tareas quedan fuera
de esta fase.
