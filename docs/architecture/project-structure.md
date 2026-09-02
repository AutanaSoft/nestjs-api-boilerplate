# Estructura del proyecto

Status: Target

Este documento define la estructura estática objetivo de la aplicación y las reglas de ownership entre sus componentes.

## Organización

Las capacidades de aplicación se organizan mediante Feature Modules:

```text
src/
├── modules/
├── database/
├── common/
├── config/
├── app.module.ts
├── app.setup.ts
└── main.ts
```

Cada Feature se ubica bajo:

```text
src/modules/<feature>/
```

La infraestructura transversal permanece fuera de `src/modules`.

## Feature Modules

Un Feature Module es el límite principal de ownership de una capacidad.

El código específico de un Feature debe permanecer dentro de su módulo propietario, salvo que represente infraestructura genuinamente transversal.

Los Features deben mantenerse planos mientras sean pequeños e introducir directorios por responsabilidad únicamente cuando el crecimiento lo justifique.

Una estructura puede evolucionar hacia:

```text
src/modules/<feature>/
├── controllers/
├── services/
├── repositories/
├── dto/
├── contracts/
└── <feature>.module.ts
```

No cree directorios vacíos únicamente para cumplir esta estructura.

## Module Ownership

Cada Provider debe tener un único módulo propietario.

Los consumidores deben importar el módulo propietario en lugar de redeclarar sus Providers.

Los módulos deben exportar únicamente las capacidades que otros módulos necesiten consumir.

## Controllers

Los Controllers poseen responsabilidades de transport y delegan el comportamiento de aplicación a Services.

No deben contener lógica sustancial de negocio ni acceso directo a persistencia.

Divida Controllers cuando un Feature exponga responsabilidades HTTP claramente distintas.

## Services

Los Services poseen comportamientos cohesivos de aplicación o dominio.

Un Feature puede contener varios Services cuando existan responsabilidades independientes.

No agrupe comportamiento no relacionado únicamente para conservar un único `<feature>.service.ts`.

## Repositories

Los Repositories representan el boundary entre un Feature y su persistencia.

Su estrategia, responsabilidades, lifecycle y reglas de acceso se definen en `data-access.md`.

La estructura del Feature sólo requiere que los Repositories permanezcan bajo el ownership del Feature correspondiente.

## Contracts

Los contratos específicos de un Feature permanecen bajo el ownership de ese Feature.

Las convenciones del contrato HTTP público se definen en `../api/http-contracts.md`.

## Infraestructura

La infraestructura transversal se ubica fuera de `src/modules`.

Las ubicaciones principales son:

```text
src/database/
src/config/
src/common/
```

`src/common` debe reservarse para código genuinamente transversal sin un Feature owner natural.

No mueva código a `common` únicamente porque sea reutilizado o porque su ownership no esté claro.

## Reglas

1. Organice las capacidades de aplicación mediante Feature Modules bajo `src/modules`.
2. Mantenga el código específico de cada Feature dentro de su módulo propietario.
3. Introduzca directorios por responsabilidad únicamente cuando el crecimiento del Feature lo justifique.
4. Asigne a cada Provider un único módulo propietario.
5. Comparta Providers mediante imports y exports explícitos.
6. Mantenga Controllers enfocados en transport.
7. Mantenga Services enfocados en comportamiento cohesivo.
8. Mantenga Repositories bajo el ownership del Feature y delegue sus reglas detalladas a `data-access.md`.
9. Mantenga infraestructura transversal fuera de `src/modules`.
10. Reserve `src/common` para responsabilidades genuinamente transversales.
