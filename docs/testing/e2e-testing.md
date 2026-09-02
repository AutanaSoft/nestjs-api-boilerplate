# Pruebas E2E

Status: Target

Este documento define las convenciones específicas de E2E Testing.

El baseline HTTP E2E ya forma parte del proyecto. Las reglas de infraestructura, persistencia y autenticación aplican a
medida que esas capacidades formen parte de la aplicación.

Las convenciones generales de testing se definen en `testing.md`.

## Límite de la aplicación

Los E2E Tests deben ejecutar la aplicación desde la misma application root y reutilizar el bootstrap compartido con
producción.

Los componentes internos relevantes para el comportamiento probado deben permanecer reales.

La configuración específica de E2E puede aislar infraestructura o external Providers, pero no debe sustituir el flujo
interno que el escenario pretende verificar.

## Lifecycle Ownership

Un entorno E2E compartido debe tener un único lifecycle owner.

Ese owner es responsable, según corresponda, de:

- crear la aplicación;
- preparar el test environment;
- preparar infraestructura aislada;
- ejecutar migrations;
- registrar las suites;
- cerrar la aplicación;
- liberar infraestructura;
- restaurar el entorno modificado.

El Test Runner debe descubrir únicamente los entry points responsables del lifecycle.

Las suites importadas no deben ejecutarse adicionalmente como entry points independientes.

## Estructura

La suite puede crecer de forma incremental:

```text
test/
├── main.e2e-spec.ts
├── support/
├── fixtures/
└── modules/
```

Los directorios se introducen únicamente cuando exista contenido que lo justifique.

## Independencia

Los escenarios independientes deben preparar sus propios prerequisites y permanecer seguros al reordenarse.

Un ordered business flow puede compartir estado cuando la secuencia sea parte explícita del comportamiento probado.

Ese estado debe pertenecer a un contexto tipado de la suite y no a variables globales implícitas.

Las reglas generales de determinismo y Test Data se definen en `testing.md`.

## Infraestructura real

Cuando una capacidad dependa de infraestructura persistente, los E2E Tests deben utilizar una instancia real y aislada
de la misma tecnología utilizada por la aplicación.

La arquitectura de persistencia se define en `../architecture/data-access.md`.

Cuando PostgreSQL y Prisma formen parte de la aplicación, el entorno E2E debe utilizar una base de datos PostgreSQL
aislada y el production Prisma persistence path.

El entorno debe aplicar las migrations versionadas y eliminar los recursos temporales al finalizar.

Las bases de datos de desarrollo y producción no deben reutilizarse como E2E databases.

## Componentes internos

No sustituya componentes internos relevantes para el comportamiento E2E, como:

- Controllers;
- Guards;
- Pipes;
- Interceptors;
- Application Services;
- Repositories;
- persistence infrastructure.

Un escenario que reemplaza la lógica interna que afirma verificar no representa cobertura E2E completa de esa
responsabilidad.

## Autenticación

Cuando la aplicación sea responsable de emitir credentials, los escenarios autenticados deben obtenerlas mediante el
public authentication flow.

No utilice tokens pre-issued para omitir el flujo de autenticación que el escenario necesita verificar.

## Prerequisites

Cree application data mediante la API pública cuando exista una operación pública razonable para producir ese estado.

Utilice direct persistence Seeds únicamente cuando el prerequisite:

- no tenga una API pública apropiada;
- sea desproporcionadamente costoso mediante HTTP;
- requiera high-volume setup;
- represente un estado técnico especial.

Los Seeds deben ser mínimos y no deben omitir el comportamiento que el escenario pretende verificar.

## Assertions

Las E2E Assertions deben centrarse en comportamiento observable:

- HTTP status;
- Response contracts;
- headers;
- cookies;
- authorization behavior;
- persisted effects;
- external effects;
- ausencia de información no permitida.

No verifique llamadas internas a métodos de Services, Repositories u ORM.

Cuando sea práctico, verifique persisted effects mediante una operación pública posterior.

## External Boundaries

Las dependencias externas out-of-process pueden aislarse cuando utilizar el Provider real sea inseguro, no determinista,
costoso o no esté disponible.

Reemplace únicamente el adapter que cruza el process boundary.

```text
Application flow
      ↓
External adapter
      ↓
Test replacement
```

No sustituya el Application Service responsable del caso de uso.

El replacement debe permitir verificar el outgoing contract sin ejecutar el side effect real.

## Teardown

El lifecycle owner debe liberar todos los recursos creados por el entorno E2E.

Esto incluye, cuando corresponda:

- aplicación NestJS;
- database clients y connections;
- temporary databases;
- external Provider replacements;
- environment state modificado.

No dependa de forced process termination para ocultar recursos no liberados.

## Reglas

1. Verifique E2E mediante el límite real de la aplicación.
2. Reutilice application bootstrap behavior derivado de producción.
3. Mantenga un único lifecycle owner por entorno compartido.
4. Impida que suites importadas se ejecuten adicionalmente como entry points.
5. Mantenga reales los componentes internos relevantes para el escenario.
6. Utilice infraestructura real y aislada cuando la capacidad probada dependa de ella.
7. Cree prerequisites mediante interfaces públicas cuando sea razonable.
8. Utilice direct Seeds únicamente cuando estén justificados.
9. Verifique comportamiento observable y no internal calls.
10. Aísle únicamente external out-of-process boundaries cuando sea necesario.
11. Libere todos los recursos creados por el test environment.
12. Aplique las convenciones generales de determinismo, Test Data y aislamiento definidas en `testing.md`.
