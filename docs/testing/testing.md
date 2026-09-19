# Pruebas

Status: Implemented

Este documento define las convenciones generales de testing del proyecto.

El proyecto utiliza Vitest como Test Runner.

## Alcance

Las pruebas deben verificar el comportamiento en el límite práctico más pequeño.

Utilice Unit Tests para comportamiento aislado y E2E Tests cuando el comportamiento deba verificarse mediante el límite
real de la aplicación.

No utilice E2E Tests para reemplazar Unit Tests enfocados ni Unit Tests para afirmar integración que sólo existe en
runtime.

## Unit Tests

Los Unit Tests deben mantenerse junto al código que verifican y seguir su mismo ownership.

Las convenciones estructurales del código se definen en `../architecture/project-structure.md`.

## Aislamiento

Los Unit Tests deben aislar el componente bajo prueba de dependencias fuera de su responsabilidad.

Utilice Test Doubles únicamente cuando la prueba no pretenda verificar la implementación real de esa dependencia.

No mockee detalles internos del componente bajo prueba ni reproduzca innecesariamente la implementación completa de una
dependencia.

## Assertions

Prefiera Assertions sobre comportamiento observable:

- valores devueltos;
- errores;
- state transitions;
- interacciones externas cuando formen parte del contrato del componente.

Evite Assertions acopladas a detalles privados de implementación.

## Test Data

Cada escenario debe utilizar datos propios y evitar shared mutable state.

Utilice factories o builders cuando múltiples pruebas necesiten inputs válidos equivalentes.

Los inputs inválidos deben derivarse preferiblemente de un input válido modificando únicamente la condición relevante
para el escenario.

## Determinismo

Las pruebas no deben depender de:

- execution order;
- datos creados por pruebas no relacionadas;
- production services;
- acceso a red no controlado;
- shared mutable global state.

Controle tiempo, aleatoriedad y otras non-deterministic dependencies cuando afecten el comportamiento probado.

## Cobertura

La cobertura es una señal de diagnóstico, no un objetivo por sí mismo.

Priorice cobertura significativa de comportamiento, especialmente:

- business rules;
- validation behavior;
- security-sensitive behavior;
- error paths;
- module boundaries;
- persistence behavior cuando corresponda.

No agregue pruebas de bajo valor únicamente para aumentar un porcentaje de cobertura.

## Process lifecycle tests

`pnpm run test:shutdown-process` construye la aplicación y ejecuta una suite POSIX aislada contra el proceso compilado
real. Verifica `SIGTERM`, `SIGINT`, cierre del listener y el cierre correcto con una solicitud JSON incompleta real; no
es parte del discovery unitario ni de la suite HTTP E2E.

El watchdog, la completación tardía y el fallo de `app.close()` se prueban de forma determinista con fake timers en los
unit tests del coordinador. Esta frontera de evidencia se seleccionó tras el comportamiento observado en Node 26, donde
la solicitud incompleta real cerró sin producir una salida por timeout de proceso. Por tanto, no se afirma esa cobertura
a nivel de proceso.

## E2E Testing

Los E2E Tests tienen requisitos específicos de runtime, lifecycle, infraestructura y external boundaries.

Esas convenciones se definen en `e2e-testing.md`.

## Reglas

1. Utilice Vitest como Test Runner.
2. Pruebe el comportamiento en el límite práctico más pequeño.
3. Mantenga los Unit Tests junto al código que verifican.
4. Aísle únicamente dependencias fuera de la responsabilidad bajo prueba.
5. Evite probar private implementation details.
6. Utilice test data independiente y determinista.
7. No dependa del execution order ni de shared mutable state.
8. Prefiera Assertions sobre comportamiento observable.
9. Priorice cobertura de comportamiento sobre porcentajes de cobertura.
10. Utilice E2E Tests cuando el comportamiento deba verificarse mediante el límite real de la aplicación.
11. Mantenga la evidencia de lifecycle de proceso en su suite compilada aislada y los resultados deterministas del
    coordinador en unit tests.
