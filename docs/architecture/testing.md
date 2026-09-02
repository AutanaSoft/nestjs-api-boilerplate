# Pruebas

Este documento define las convenciones generales de testing del proyecto.

El proyecto utiliza Vitest como Test Runner.

## Alcance de las pruebas

Las pruebas deben verificar el comportamiento en el límite práctico más pequeño.

Utilice Unit Tests para comportamiento de aplicación aislado y E2E Tests para comportamiento que deba demostrarse
mediante la API HTTP pública y la infraestructura real de la aplicación.

No utilice E2E Tests para reemplazar Unit Tests enfocados, ni Unit Tests para afirmar cobertura de integración en runtime.

## Unit Tests

Los Unit Tests deben mantenerse cerca del código que verifican.

Por ejemplo:

```text
src/modules/users/
├── users.service.ts
├── users.service.spec.ts
├── users.controller.ts
└── users.controller.spec.ts
```

Las pruebas deben seguir el mismo Feature Ownership que el código de producción.

No cree un directorio para todo el repositorio organizado únicamente por tipo técnico de prueba para Unit Tests propiedad
de Features.

## Aislamiento

Los Unit Tests deben aislar el componente bajo prueba de external dependencies y colaboradores no relacionados.

Las dependencias pueden reemplazarse por Test Doubles controlados cuando la prueba no pretenda verificar esas
implementaciones.

Por ejemplo, un Unit Test de un Service puede reemplazar su Repository por un Test Double:

```text
UsersService
    ↓
UsersRepository Test Double
```

La prueba debe verificar el contrato y comportamiento del Service, en lugar de los detalles de implementación del ORM o
la base de datos.

## Test Doubles

Utilice Test Doubles únicamente en las dependencias fuera de la responsabilidad que se está probando.

Evite mockear detalles de implementación internos del componente bajo prueba.

Los Test Doubles deben exponer el comportamiento mínimo requerido por el escenario y no deben reproducir la
implementación completa de la dependencia real.

## Assertions

Prefiera Assertions contra resultados y contratos observables.

Los ejemplos incluyen:

- valores devueltos;
- errores lanzados;
- state transitions propiedad del componente;
- llamadas a una external dependency cuando esa interacción forma parte del contrato del componente.

Evite Assertions que acoplen innecesariamente las pruebas a detalles de implementación privados.

## Test Data

Las pruebas deben crear datos nuevos para cada escenario.

Evite shared mutable test objects entre casos.

Utilice factories o builders canónicos cuando múltiples pruebas requieran inputs válidos equivalentes.

Los invalid test inputs deben derivarse preferiblemente de un fresh valid input modificando únicamente la propiedad
relevante para el escenario.

## Determinismo

Las pruebas no deben depender de:

- execution order;
- datos creados por pruebas no relacionadas;
- production services;
- acceso a red no controlado;
- shared mutable global state.

El tiempo, la aleatoriedad y otras non-deterministic dependencies deben controlarse cuando afecten el comportamiento bajo
prueba.

## Cobertura

La cobertura es una señal de diagnóstico, no un objetivo arquitectónico por sí mismo.

Priorice una cobertura significativa de:

- business rules;
- validation behavior;
- security-sensitive behavior;
- error paths;
- module boundaries;
- persistence behavior cuando corresponda.

No agregue pruebas de bajo valor únicamente para aumentar un porcentaje de cobertura.

## Límite E2E

Los E2E Tests tienen requisitos distintos de lifecycle, infraestructura, Fixtures y external boundaries.

Esas convenciones se definen por separado en `e2e-testing.md`.

## Reglas

1. Utilice Vitest como Test Runner del proyecto.
2. Mantenga los Unit Tests propiedad de Features cerca de su código de producción.
3. Pruebe el comportamiento en el límite práctico más pequeño.
4. Aísle dependencias no relacionadas en los Unit Tests.
5. Evite probar private implementation details.
6. Utilice fresh y deterministic test data.
7. No haga que las pruebas dependan del execution order ni de shared mutable state.
8. Utilice Test Doubles únicamente en los límites fuera de la responsabilidad bajo prueba.
9. Priorice una cobertura de comportamiento significativa sobre los porcentajes de cobertura.
10. Utilice E2E Tests cuando el comportamiento deba verificarse a través del límite real de la aplicación.
