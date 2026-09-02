# Estructura del proyecto

Este documento define las convenciones de arquitectura estructural para el Boilerplate de API de NestJS.

El proyecto se organiza alrededor de módulos de funcionalidades, compartición explícita de módulos, componentes de
responsabilidad única y límites de persistencia basados en repositorios.

## Organización del proyecto

Las funcionalidades de la aplicación se ubican en:

```text
src/modules/<feature>/
```

Cada funcionalidad es propietaria de sus controladores, servicios, repositorios, contratos y otros componentes de
soporte.

La infraestructura transversal a funcionalidades permanece fuera de `src/modules`.

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

El código de la aplicación no debe organizarse globalmente por capa técnica.

## Estructura de funcionalidades

Las funcionalidades deben mantenerse planas mientras sean pequeñas e introducir directorios basados en responsabilidades
a medida que crecen.

Una funcionalidad pequeña puede usar:

```text
src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
├── users.repository.ts
└── dto/
```

Una funcionalidad más grande puede usar:

```text
src/modules/users/
├── controllers/
│   ├── users.controller.ts
│   └── user-profile.controller.ts
├── services/
│   ├── users.service.ts
│   └── user-profile.service.ts
├── repositories/
│   └── users.repository.ts
├── dto/
├── contracts/
└── users.module.ts
```

Los directorios deben introducirse porque existen múltiples componentes con la misma responsabilidad, no como
boilerplate obligatorio.

Los límites de los componentes deben seguir la responsabilidad, en lugar de preservar un único archivo
`<feature>.controller.ts`, `<feature>.service.ts` o `<feature>.repository.ts`.

## Límites de módulos

Un módulo de funcionalidad es el límite de propiedad para una capacidad de la aplicación.

El código específico de una funcionalidad debe permanecer dentro de su módulo propietario, salvo que represente
infraestructura genuinamente compartida.

Cada proveedor tiene un módulo propietario. Los consumidores importan ese módulo en lugar de redeclarar sus proveedores.

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

```typescript
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

Los módulos deben exponer únicamente los proveedores requeridos por otros módulos.

Los repositorios normalmente deben permanecer privados para su funcionalidad propietaria.

## Controladores

Los controladores son propietarios de superficies de transporte cohesivas y delegan el comportamiento de la aplicación a
los servicios.

No deben contener lógica de persistencia ni lógica de negocio sustancial.

Cuando una funcionalidad expone múltiples responsabilidades HTTP distintas, esas responsabilidades deben dividirse entre
controladores.

Por ejemplo:

```text
controllers/
├── users.controller.ts
├── user-profile.controller.ts
└── user-password.controller.ts
```

Los límites de los controladores deben seguir la responsabilidad HTTP, en lugar de forzar todos los endpoints de una
funcionalidad en un solo controlador.

## Servicios

Los servicios son propietarios de comportamientos cohesivos de aplicación o dominio.

Una funcionalidad puede contener uno o varios servicios.

No agrupe responsabilidades no relacionadas en un único servicio solo para preservar una convención de nombres
`<feature>.service.ts`.

Por ejemplo:

```text
services/
├── orders.service.ts
├── order-pricing.service.ts
└── order-status.service.ts
```

Los límites de los servicios deben seguir la responsabilidad, en lugar de las convenciones de cantidad de archivos.

## Repositorios

Los repositorios encapsulan el acceso a persistencia.

Las consultas, joins, filtros, mapeo de persistencia y responsabilidades relacionadas con el acceso a datos específicos
de ORM pertenecen a los repositorios, en lugar de a los servicios.

```text
Controlador
    ↓
Servicio
    ↓
Repositorio
    ↓
Infraestructura de persistencia
```

Una funcionalidad puede contener varios repositorios cuando las responsabilidades de persistencia son distintas.

Los repositorios se requieren únicamente para funcionalidades que poseen comportamiento de persistencia.

## DTO y contratos

Las definiciones de entrada y salida específicas de transporte pertenecen a la funcionalidad que posee el límite HTTP
correspondiente.

Los esquemas y tipos reutilizables propiedad de una funcionalidad pertenecen a esa misma funcionalidad y deben
mantenerse separados de los detalles de implementación de persistencia.

Las ubicaciones habituales son:

```text
dto/
contracts/
```

Sus convenciones detalladas de propiedad y validación se definen por separado de este documento estructural.

## Infraestructura

La infraestructura transversal a funcionalidades se ubica fuera de `src/modules`.

Los ejemplos incluyen:

```text
src/database/
src/config/
src/common/
```

Los módulos de infraestructura pueden exponer capacidades técnicas requeridas por repositorios de funcionalidades u
otros componentes de infraestructura.

Los servicios de aplicación deben depender de abstracciones de funcionalidades, en lugar de hacerlo directamente de
clientes de persistencia.

## Código compartido

`src/common` está reservado para código genuinamente transversal sin un propietario natural de funcionalidad.

El código no debe moverse a `common` simplemente porque se reutiliza o porque su propiedad no es clara.

Prefiera mantener el comportamiento junto con la funcionalidad que lo posee.

## Reglas

1. Organice la funcionalidad de la aplicación por funcionalidad en `src/modules`.
2. Mantenga los componentes específicos de una funcionalidad dentro de su módulo propietario.
3. Mantenga las funcionalidades planas mientras sean pequeñas e introduzca directorios basados en responsabilidades a
   medida que crecen.
4. Divida los controladores, servicios y repositorios según una responsabilidad cohesiva cuando sea necesario.
5. Asigne a cada proveedor un módulo propietario.
6. Comparta proveedores mediante importaciones de módulos y exportaciones explícitas.
7. Mantenga los controladores enfocados en las responsabilidades de transporte.
8. Mantenga los servicios enfocados en una responsabilidad cohesiva.
9. Encapsule el acceso a persistencia en repositorios.
10. Mantenga la lógica específica de ORM fuera de los servicios de aplicación.
11. Mantenga privados los repositorios de funcionalidades, salvo que un requisito documentado justifique exponerlos.
12. Mantenga la infraestructura compartida fuera de `src/modules`.
