# Autenticación

Este documento define la arquitectura del módulo de autenticación.

## Decisiones

| Responsabilidad | Decisión |
| --- | --- |
| Access Tokens | JWT |
| JWT integration | `@nestjs/jwt` |
| Password hashing | Argon2id |
| Password hashing library | `argon2` |
| Refresh Tokens | Opaque tokens |
| Refresh Token state | Persistencia server-side |
| Request authentication | NestJS Guards |
| Authentication context | `AuthenticatedPrincipal` |

Passport no forma parte de la arquitectura predeterminada.

## Dependencias

```text
@nestjs/jwt
argon2
node:crypto
```

No introduzca otra estrategia de JWT, password hashing o authentication framework sin una decisión arquitectónica explícita.

## Module Boundary

La autenticación pertenece a:

```text
src/modules/auth/
```

La gestión de usuarios pertenece a:

```text
src/modules/users/
```

La dependencia permitida es:

```text
AuthModule
    ↓
UsersModule
```

`AuthModule` consume la API pública de `UsersModule` y no accede directamente a `UsersRepository`.

La persistencia específica de sesiones y Refresh Tokens pertenece a `AuthModule`.

## Estructura

```text
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── config/
│   └── auth.config.ts
├── decorators/
│   ├── current-principal.decorator.ts
│   └── public.decorator.ts
├── guards/
│   └── access-token.guard.ts
├── repositories/
│   └── auth-sessions.repository.ts
├── types/
│   └── authenticated-principal.type.ts
└── dto/
```

Los directorios se crean únicamente cuando exista código que los justifique.

## Access Tokens

Los Access Tokens utilizan JWT mediante `@nestjs/jwt`.

Deben ser short-lived y mantener un payload mínimo.

Claims base:

```text
sub
iat
exp
```

Pueden incluir `iss`, `aud` y `sid` cuando la configuración o estrategia de sesión lo requiera.

No deben incluir información sensible ni records completos de usuario.

## Refresh Tokens

Los Refresh Tokens son opaque tokens generados mediante `node:crypto`.

Su estado se mantiene server-side para permitir:

- expiration;
- rotation;
- revocation;
- session management.

Los tokens reutilizables no deben persistirse directamente; debe almacenarse una representación segura.

La persistencia pertenece a `AuthSessionsRepository`.

## Password Hashing

Las passwords utilizan Argon2id mediante `argon2`.

Las plain-text passwords nunca deben persistirse.

La persistencia de usuarios almacena únicamente el password hash resultante.

## Authentication Guard

Los Endpoints protegidos utilizan:

```text
AccessTokenGuard
```

El Guard es responsable de validar el Access Token y establecer el principal autenticado.

La autorización no pertenece al Guard de autenticación.

La estrategia preferida es authentication global con Endpoints públicos declarados mediante:

```typescript
@Public()
```

## AuthenticatedPrincipal

La identidad autenticada se representa mediante un contrato interno independiente de JWT, Prisma y HTTP.

```typescript
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId?: string;
}
```

Los consumidores deben depender de este contrato y no del JWT payload completo.

## Persistencia

`UsersModule` posee los datos y credentials del usuario.

`AuthModule` posee el estado de autenticación.

```text
UsersModule
    ↓
User persistence

AuthModule
    ↓
Auth session persistence
```

La persistencia específica de Auth se accede mediante:

```text
AuthService
    ↓
AuthSessionsRepository
    ↓
Prisma
```

## Configuración

La configuración pertenece a:

```text
src/modules/auth/config/auth.config.ts
```

Debe incluir únicamente valores propios de autenticación, como:

```text
JWT signing key
JWT issuer
JWT audience
Access Token lifetime
Refresh Token lifetime
Argon2 parameters
```

## Reglas

1. Mantenga `AuthModule` separado de `UsersModule`.
2. Utilice JWT mediante `@nestjs/jwt` para Access Tokens.
3. Utilice Argon2id mediante `argon2` para password hashing.
4. Utilice opaque Refresh Tokens con estado server-side.
5. Mantenga la persistencia de sesiones dentro de `AuthModule`.
6. Utilice Refresh Token rotation y revocation.
7. Mantenga los Access Tokens short-lived.
8. Mantenga los JWT payloads mínimos.
9. Utilice `AccessTokenGuard` para Request authentication.
10. Prefiera authentication global con `@Public()` para excepciones.
11. Mantenga Authentication y Authorization como responsabilidades separadas.
12. Exponga la identidad mediante `AuthenticatedPrincipal`.
13. Mantenga `AuthService` independiente de Prisma y detalles HTTP.
14. Mantenga la configuración y secrets dentro del boundary de Auth.
15. No utilice Passport como dependencia predeterminada.
