# Pruebas

Este documento define las convenciones generales de pruebas para el Boilerplate de API de NestJS.

El proyecto utiliza Vitest como ejecutor de pruebas.

## Alcance de las pruebas

Las pruebas deben verificar el comportamiento en el límite práctico más pequeño.

Utilice pruebas unitarias para comportamiento de aplicación aislado y pruebas E2E para comportamiento que deba
demostrarse mediante la API HTTP pública y la infraestructura real de la aplicación.

No utilice pruebas E2E para reemplazar pruebas unitarias enfocadas, ni pruebas unitarias para afirmar cobertura de
integración en tiempo de ejecución.

## Pruebas unitarias

Las pruebas unitarias deben mantenerse cerca del código que verifican.

Por ejemplo:

```text
src/modules/users/
├── users.service.ts
├── users.service.spec.ts
├── users.controller.ts
└── users.controller.spec.ts
```

Las pruebas deben seguir la misma propiedad de funcionalidades que el código de producción.

No cree un directorio para todo el repositorio organizado únicamente por tipo técnico de prueba para pruebas unitarias
propiedad de funcionalidades.

## Aislamiento

Las pruebas unitarias deben aislar el componente bajo prueba de dependencias externas y colaboradores no relacionados.

Las dependencias pueden reemplazarse por dobles de prueba controlados cuando la prueba no pretenda verificar esas
implementaciones.

Por ejemplo, una prueba unitaria de servicio puede reemplazar su repositorio por un doble de prueba:

```text
UsersService
    ↓
UsersRepository de prueba
```

La prueba debe verificar el contrato y comportamiento del servicio, en lugar de los detalles de implementación de ORM o
base de datos.

## Dobles de prueba

Utilice dobles de prueba únicamente en las dependencias fuera de la responsabilidad que se está probando.

Evite simular detalles de implementación internos del componente bajo prueba.

Los dobles de prueba deben exponer el comportamiento más pequeño requerido por el escenario y no deben reproducir la
implementación completa de la dependencia real.

## Aserciones

Prefiera aserciones contra resultados y contratos observables.

Los ejemplos incluyen:

- valores devueltos;
- errores lanzados;
- transiciones de estado propiedad del componente;
- llamadas a una dependencia externa cuando esa interacción forma parte del contrato del componente.

Evite aserciones que acoplen innecesariamente las pruebas a detalles de implementación privados.

## Datos de prueba

Las pruebas deben crear datos nuevos para cada escenario.

Evite objetos de prueba mutables compartidos entre casos.

Utilice fábricas o constructores canónicos cuando múltiples pruebas requieran entradas válidas equivalentes.

Las entradas de prueba inválidas deben derivarse preferiblemente de una entrada válida nueva modificando únicamente la
propiedad relevante para el escenario.

## Determinismo

Las pruebas no deben depender de:

- orden de ejecución;
- datos creados por pruebas no relacionadas;
- servicios de producción;
- acceso a red no controlado;
- estado global mutable compartido.

El tiempo, la aleatoriedad y otras dependencias no deterministas deben controlarse cuando afecten el comportamiento bajo
prueba.

## Cobertura

La cobertura es una señal de diagnóstico, no un objetivo arquitectónico por sí mismo.

Priorice una cobertura significativa de:

- reglas de negocio;
- comportamiento de validación;
- comportamiento sensible a la seguridad;
- rutas de error;
- límites de módulos;
- comportamiento de persistencia cuando corresponda.

No agregue pruebas de bajo valor únicamente para aumentar un porcentaje de cobertura.

## Límite E2E

Las pruebas de extremo a extremo tienen requisitos distintos de ciclo de vida, infraestructura, fixtures y límites
externos.

Esas convenciones se definen por separado en `e2e-testing.md`.

## Reglas

1. Utilice Vitest como ejecutor de pruebas del proyecto.
2. Mantenga las pruebas unitarias propiedad de funcionalidades cerca de su código de producción.
3. Pruebe el comportamiento en el límite práctico más pequeño.
4. Aísle dependencias no relacionadas en las pruebas unitarias.
5. Evite probar detalles de implementación privados.
6. Utilice datos de prueba nuevos y deterministas.
7. No haga que las pruebas dependan del orden de ejecución ni del estado mutable compartido.
8. Utilice dobles de prueba únicamente en los límites fuera de la responsabilidad bajo prueba.
9. Priorice una cobertura de comportamiento significativa sobre los porcentajes de cobertura.
10. Utilice pruebas E2E cuando el comportamiento deba verificarse a través del límite real de la aplicación.
