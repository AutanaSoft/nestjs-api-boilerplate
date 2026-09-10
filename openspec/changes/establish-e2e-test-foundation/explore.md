# Exploración: Establecer la base de pruebas E2E

## Estado

Listo para la propuesta después de confirmar el primer alcance recomendado. Esta exploración es de
solo lectura; no se modificó código de producción ni de prueba.

## Resumen ejecutivo

La línea base HTTP actual es suficientemente real como para ejercitar el límite público de Express:
`test/app.e2e-spec.ts` compila `AppModule`, llama al `setupApplication` compartido con producción,
inicializa Nest y envía solicitudes con Supertest. El resultado de auditoría proporcionado de cuatro
casos aprobados es coherente con ese alcance.

Todavía no es una base reutilizable. `vitest.config.e2e.ts` descubre cada `**/*.e2e-spec.ts`, por lo
que una futura suite de funcionalidad importada con ese sufijo también se convertiría en un punto de
entrada independiente de Vitest. Actualmente, la única suite posee su instantánea y mutación del
entorno, la creación de la aplicación y el cierre, pero crea una aplicación nueva para cada prueba.
Esto preserva hoy el aislamiento del límite de tasa, a la vez que dificulta centralizar la propiedad
del ciclo de vida cuando lleguen capacidades de base de datos, autenticación y adaptadores externos.

Se recomienda un único propietario principal descubierto por Vitest, `test/main.e2e-spec.ts`, con
registros de funcionalidades importados y no descubribles. Mantener pequeña la superficie de soporte
inicial: un contexto de aplicación tipado y un auxiliar de aplicación derivado de producción; los
valores E2E se declararán mediante `test.env` en lugar de un auxiliar de entorno. No agregar
abstracciones de base de datos, autenticación, fixtures, seeds ni adaptadores externos hasta que
exista la capacidad de producción correspondiente.

## Evidencia

- `vitest.config.e2e.ts` usa `include: ['**/*.e2e-spec.ts']`; este es un descubrimiento amplio, en
  lugar de un descubrimiento exclusivo del propietario del ciclo de vida.
- `test/app.e2e-spec.ts` es la única suite E2E. Captura una instantánea y muta tres variables de
  `process.env`, compila `AppModule`, aplica `setupApplication` y cierra cada aplicación después de
  cada caso.
- `src/main.ts` crea `AppModule`, obtiene la configuración tipada de `http`, aplica
  `setupApplication` y luego escucha. La suite E2E comparte correctamente el módulo raíz y el
  auxiliar de configuración, pero repite el ensamblado de bootstrap.
- Los cuatro casos de línea base cubren la respuesta raíz, las cabeceras de Helmet, el
  comportamiento CORS configurado, la solicitud previa y el límite de tasa. La creación de una
  aplicación por prueba es relevante: la prueba de límite de tasa necesita un estado nuevo del
  limitador.
- `docs/testing/testing.md` exige Vitest y datos de prueba deterministas e independientes.
  `docs/testing/e2e-testing.md` es la convención objetivo y requiere un propietario del ciclo de
  vida para un entorno compartido, solo puntos de entrada de ciclo de vida en el descubrimiento,
  componentes internos reales, bootstrap derivado de producción y desmontaje completo.
- Actualmente, el repositorio no tiene un directorio Prisma, integración de base de datos,
  funcionalidad de autenticación ni adaptador externo. `docs/architecture/data-access.md` establece
  PostgreSQL más Prisma como la dirección futura de persistencia y exige migraciones versionadas.
- `openspec/config.yaml` todavía etiqueta E2E como Playwright a pesar de que `package.json`,
  `docs/testing/testing.md` y `vitest.config.e2e.ts` establecen Vitest. Tratar esos metadatos
  generados/desactualizados como un defecto de documentación de configuración que debe corregirse
  dentro del alcance de documentación/configuración de este cambio; no introducir Playwright ni
  Jest.

## Estructuras viables

### A. Mantener el descubrimiento amplio y hacer que cada suite de funcionalidad sea autónoma

Cada `*.e2e-spec.ts` compilaría y cerraría su propia aplicación.

- Beneficio: sencillo para comprobaciones de endpoints aislados y conserva el aislamiento de
  ejecución por prueba/por archivo.
- Rechazada: entra en conflicto con el propietario único documentado cuando las suites comparten
  entorno, base de datos, migraciones o un flujo ordenado. Invita a la ejecución duplicada cuando
  los archivos se importan para su registro y no puede poseer de forma segura la futura
  infraestructura compartida.

### B. Un propietario principal descubierto con registros de funcionalidades importados — recomendado

Configurar Vitest para descubrir exactamente `test/main.e2e-spec.ts`. El propietario principal
registra funciones de funcionalidad en un orden explícito y posee la liberación de recursos por
escenario; `vitest.config.e2e.ts` posee los valores E2E mediante `test.env`. Los archivos importados
usan un sufijo/ruta excluido como `*.e2e-suite.ts` o `modules/**`, nunca `*.e2e-spec.ts`.

- Beneficio: hace revisables el ciclo de vida y el registro, evita el descubrimiento doble y tiene
  una ubicación natural para futuras sustituciones temporales de PostgreSQL, migraciones,
  proveedores y desmontaje.
- Costo: requiere interfaces deliberadas para las suites importadas y aislamiento cuidadoso de
  escenarios.
- Adecuación: implementa directamente la convención de pruebas objetivo mientras conserva Vitest.

### C. Un propietario principal más propietarios aislados descubiertos independientemente

Reservar entradas de descubrimiento explícitas adicionales para suites que crean, usan y liberan su
propia aplicación e infraestructura sin importar ni ser importadas por el propietario principal.

- Beneficio: más adelante puede admitir alcances genuinamente independientes y costosos.
- No seleccionada para el primer alcance: hoy no existe infraestructura independiente y la excepción
  agrega una política de descubrimiento antes de que haya un caso de uso demostrado.
- Restricción si se adopta más adelante: un propietario aislado no puede compartir entorno mutable,
  aplicación, base de datos ni supuestos de orden de ejecución con el propietario principal.

## Primer alcance recomendado

1. Cambiar el descubrimiento E2E al único punto de entrada del ciclo de vida,
   `test/main.e2e-spec.ts`.
2. Mover las cuatro aserciones de línea base existentes bajo un registro de funcionalidad de
   aplicación importado, demostrando que las suites importadas se ejecutan solo a través del
   propietario principal.
3. Agregar únicamente los tipos de soporte justificados ahora:
   - un tipo nombrado `E2EContext` que contenga la aplicación Nest inicializada (y, solo si las
     aserciones lo necesitan, su servidor HTTP);
   - un creador de aplicación derivado de producción que compile `AppModule`, obtenga la
     configuración tipada de `http`, llame a `setupApplication` e inicialice la aplicación;
   - un ejecutor de escenarios que cierre deterministamente cada aplicación; `vitest.config.e2e.ts`
     definirá los tres valores E2E mediante `test.env`.
4. Mantener `main.e2e-spec.ts` como el único propietario del ciclo de vida. Debe crear y cerrar un
   contexto de aplicación nuevo por escenario de línea base independiente, preservando el
   aislamiento del limitador; los archivos de funcionalidad importados registran casos, pero no usan
   hooks de ciclo de vida para crear aplicaciones ni mutar el estado del proceso.
5. Corregir los metadatos del ejecutor de OpenSpec de Playwright a Vitest y actualizar
   `docs/testing/e2e-testing.md` solo si la implementación establece una convención específica del
   proyecto de nomenclatura o comando que aún no esté expresada allí.

Esto deliberadamente no afirma una única instancia de Nest de larga duración. Un propietario único
puede crear una aplicación con alcance de escenario cuando el aislamiento lo exija. Cuando llegue
infraestructura persistente, el propietario debería poseer en su lugar el ciclo de vida de la base
de datos temporal compartida y establecer reglas explícitas de limpieza/restablecimiento de base de
datos; cualquier flujo ordenado debería usar un contexto tipado propiedad de la funcionalidad en vez
de depender del orden de prueba.

## Decisiones de integración futuras (aplazadas hasta que sean necesarias)

| Capacidad            | Extensión de la base                                                                                                                                                                                                                                                                                                | Medida de protección                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL + Prisma  | El propietario principal crea una base de datos PostgreSQL temporal, aislada e impredecible a partir de una URL administrativa validada exclusiva de E2E, aplica las migraciones confirmadas de Prisma, inyecta su URL antes del bootstrap de la aplicación y luego cierra los clientes y elimina la base de datos. | Nunca reutilizar bases de datos de desarrollo o producción; fallar de forma segura ante URL ambiguas o inseguras.                                   |
| Autenticación        | Los escenarios de autenticación obtienen credenciales mediante el flujo público de registro/inicio de sesión. Usar un contexto de funcionalidad de autenticación únicamente para un flujo de negocio explícitamente ordenado.                                                                                       | No usar tokens preemitidos para eludir el flujo bajo prueba.                                                                                        |
| Proveedores externos | El entorno E2E sustituye centralmente solo el adaptador vinculado a DI que cruza el límite fuera de proceso y captura su contrato saliente.                                                                                                                                                                         | No simular controladores, guards, servicios de aplicación, repositorios, ORM ni persistencia.                                                       |
| Fixtures y seeds     | Agregar fábricas de payloads nuevos cuando una funcionalidad necesite entradas válidas repetidas; crear prerrequisitos mediante HTTP de forma predeterminada.                                                                                                                                                       | Permitir seeds directos mínimos solo para prerrequisitos documentados incidentales, no disponibles, costosos, de estado especial o de alto volumen. |

## Decisiones y límites de alcance

### Decisiones propuestas

- Vitest sigue siendo el ejecutor E2E obligatorio y `pnpm test:e2e` sigue siendo el comando del
  proyecto.
- Un punto de entrada principal es el propietario del ciclo de vida predeterminado para el entorno
  E2E compartido.
- Los registros de funcionalidades importados no son puntos de entrada descubribles por el ejecutor.
- El bootstrap E2E usa `AppModule` y `setupApplication`, preservando el comportamiento HTTP de
  producción sin modificar el bootstrap de producción.
- Los valores E2E son responsabilidad de `test.env` en la configuración de Vitest; el helper no lee,
  modifica ni restaura `process.env`.
- Los escenarios de endpoint independientes deben permanecer reordenables. El contexto mutable
  tipado se limita a un flujo ordenado explícito propiedad de una funcionalidad.

### Dentro del alcance

- Descubrimiento de Vitest E2E y organización de puntos de entrada.
- Reubicación/registro de pruebas de línea base existentes sin cambiar sus aserciones HTTP.
- Contexto tipado mínimo, bootstrap de aplicación, propiedad del entorno, desmontaje y corrección
  correspondiente de documentación/configuración.

### Objetivos no incluidos

- Agregar PostgreSQL, Prisma, migraciones, autenticación, funcionalidades de dominio, fixtures,
  seeds o adaptadores de proveedores externos antes de que existan necesidades de producción.
- Introducir Jest, Playwright, un módulo de aplicación de prueba separado, persistencia en memoria,
  tokens de autenticación preemitidos o simulaciones de componentes internos de aplicación.
- Rediseñar el contrato HTTP público, la configuración de producción o el comportamiento del
  throttling.

## Riesgos y mitigaciones

- **El estado del límite de tasa se filtra entre escenarios de línea base.** Conservar la creación
  de aplicaciones nuevas para escenarios independientes hasta que exista un mecanismo de
  restablecimiento determinista; no convertir una aplicación única de larga duración en una
  optimización no examinada.
- **Una futura suite importada se ejecuta dos veces.** Restringir el descubrimiento de Vitest a
  `main.e2e-spec.ts` y reservar un sufijo/ruta excluido para las importaciones.
- **Valores E2E externos alteran los contratos.** `test.env` declara los tres valores y la ejecución
  E2E con valores externos conflictivos debe probar que la configuración de Vitest prevalece.
- **Los futuros propietarios concurrentes mutan `process.env`.** No introducir propietarios
  descubiertos independientemente que compartan esas variables; los propietarios aislados explícitos
  deben usar un alcance de configuración independiente o un modelo de serialización acordado.
- **El futuro trabajo de base de datos contamina los datos de los operadores.** Diseñar el auxiliar
  de base de datos solo con una URL administrativa exclusiva de E2E, nombres de base de datos
  impredecibles, migraciones y limpieza garantizada cuando se introduzcan PostgreSQL/Prisma.
- **Los metadatos generados de OpenSpec causan confusión sobre el ejecutor.** Alinear
  `openspec/config.yaml` con los documentos de paquete y pruebas autoritativos del repositorio
  durante el alcance.

## Plan de validación para la fase de implementación

Ejecutar `pnpm test:e2e` para demostrar que el único propietario descubierto ejecuta las cuatro
aserciones de línea base, y después ejecutar las comprobaciones relevantes de lint/tipos/formato del
repositorio definidas por los archivos modificados. No se ejecutaron comandos durante esta
exploración.

## Guía aplicada

- `nestjs-e2e-practices`: tarjetas de orquestación/ciclo de vida, aplicación real e infraestructura
  aislada, datos/contratos y límite externo.
- `nestjs-practices`: tarjetas de aislamiento de fuente de configuración, validación de
  configuración con espacio de nombres y registro de contexto de aplicación.
- `ts-general-practices`: tipo de forma de objeto reutilizable nombrado y guía de importación solo
  de tipos.
