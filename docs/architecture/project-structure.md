# Estructura del proyecto

Este documento define las convenciones de arquitectura estructural del proyecto.

El proyecto se organiza alrededor de Feature Modules, module sharing explícito, componentes de responsabilidad única y
límites de persistencia basados en Repositories.

## Organización del proyecto

Los Features de la aplicación se ubican en:

```text
src/modules/<feature>/
```

Cada Feature es responsable de sus Controllers, Services, Repositories, contratos y otros componentes de soporte.

La infraestructura transversal a Features permanece fuera de `src/modules`.

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

## Estructura de Features

Los Features deben mantenerse planos mientras sean pequeños e introducir directorios basados en responsabilidades a
medida que crecen.

Un Feature pequeño puede usar:

```text
src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
├── users.repository.ts
└── dto/
```

Un Feature más grande puede usar:

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

Un Feature Module es el límite de ownership para una capacidad de la aplicación.

El código específico de un Feature debe permanecer dentro de su módulo propietario, salvo que represente infraestructura
genuinamente compartida.

Cada Provider tiene un único módulo propietario. Los consumidores importan ese módulo en lugar de redeclarar sus
Providers.

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

Los módulos deben exponer únicamente los Providers requeridos por otros módulos.

Los Repositories normalmente deben permanecer privados para su Feature propietario.

## Controllers

Los Controllers son responsables de superficies de transport cohesivas y delegan el comportamiento de la aplicación a
los Services.

No deben contener lógica de persistencia ni lógica de negocio sustancial.

Cuando un Feature expone múltiples responsabilidades HTTP distintas, esas responsabilidades deben dividirse entre
Controllers.

Por ejemplo:

```text
controllers/
├── users.controller.ts
├── user-profile.controller.ts
└── user-password.controller.ts
```

Los límites de los Controllers deben seguir la responsabilidad HTTP, en lugar de forzar todos los Endpoints de un Feature
en un solo Controller.

## Services

Los Services son responsables de comportamientos cohesivos de aplicación o dominio.

Un Feature puede contener uno o varios Services.

No agrupe responsabilidades no relacionadas en un único Service solo para preservar una convención de nombres
`<feature>.service.ts`.

Por ejemplo:

```text
services/
├── orders.service.ts
├── order-pricing.service.ts
└── order-status.service.ts
```

Los límites de los Services deben seguir la responsabilidad, en lugar de las convenciones de cantidad de archivos.

## Repositories

Los Repositories encapsulan el acceso a persistencia.

Las queries, joins, filtros, persistence mapping y responsabilidades relacionadas con el acceso a datos específicas del
ORM pertenecen a los Repositories, en lugar de a los Services.

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Persistence Infrastructure
```

Un Feature puede contener varios Repositories cuando las responsabilidades de persistencia son distintas.

Los Repositories se requieren únicamente para Features que poseen comportamiento de persistencia.

## DTOs y contratos

Las definiciones de input y output específicas del transport pertenecen al Feature que posee el límite HTTP
correspondiente.

Los schemas y types reutilizables propiedad de un Feature pertenecen a ese mismo Feature y deben mantenerse separados de
los detalles de implementación de persistencia.

Las ubicaciones habituales son:

```text
dto/
contracts/
```

Sus convenciones detalladas de ownership y validación se definen por separado de este documento estructural.

## Infraestructura

La infraestructura transversal a Features se ubica fuera de `src/modules`.

Los ejemplos incluyen:

```text
src/database/
src/config/
src/common/
```

Los módulos de infraestructura pueden exponer capacidades técnicas requeridas por Repositories de Features u otros
componentes de infraestructura.

Los Application Services deben depender de abstracciones de Features, en lugar de hacerlo directamente de persistence
clients.

## Código compartido

`src/common` está reservado para código genuinamente transversal sin un Feature propietario natural.

El código no debe moverse a `common` simplemente porque se reutiliza o porque su ownership no es claro.

Prefiera mantener el comportamiento junto con el Feature que lo posee.

## Reglas

1. Organice las capacidades de la aplicación por Feature dentro de `src/modules`.
2. Mantenga los componentes específicos de un Feature dentro de su módulo propietario.
3. Mantenga los Features planos mientras sean pequeños e introduzca directorios basados en responsabilidades a medida que
   crecen.
4. Divida Controllers, Services y Repositories según una responsabilidad cohesiva cuando sea necesario.
5. Asigne a cada Provider un único módulo propietario.
6. Comparta Providers mediante module imports y exports explícitos.
7. Mantenga los Controllers enfocados en responsabilidades de transport.
8. Mantenga los Services enfocados en una responsabilidad cohesiva.
9. Encapsule el acceso a persistencia en Repositories.
10. Mantenga la lógica específica del ORM fuera de los Application Services.
11. Mantenga privados los Repositories de Features, salvo que un requisito documentado justifique exponerlos.
12. Mantenga la infraestructura compartida fuera de `src/modules`.
