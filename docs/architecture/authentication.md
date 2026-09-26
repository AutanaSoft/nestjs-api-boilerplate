# Autenticación

Status: Target

Este documento define la arquitectura de autenticación de la aplicación.

La autorización se define por separado en `authorization.md`.

## Decisiones

| Responsabilidad          | Decisión                 |
| ------------------------ | ------------------------ |
| Access Tokens            | JWT                      |
| JWT integration          | `@nestjs/jwt`            |
| Password hashing         | Argon2id                 |
| Password hashing library | `argon2`                 |
| Refresh Tokens           | Opaque tokens            |
| Refresh Token state      | Server-side              |
| Request authentication   | NestJS Guards            |
| Authentication context   | `AuthenticatedPrincipal` |

Passport no forma parte de la arquitectura predeterminada.

No introduzca una estrategia alternativa de JWT, password hashing o authentication framework sin una decisión
arquitectónica explícita.

## Module Boundary

La autenticación pertenece a `AuthModule`.

La gestión de usuarios pertenece a `UsersModule`.

La dependencia permitida es:

```text
AuthModule
    ↓
UsersModule
```

`AuthModule` consume la API exportada por `UsersModule` y no accede directamente a su persistencia.

`UsersModule` posee el usuario, el hash almacenado y la condición persistente de cambio obligatorio de contraseña.
También es responsable del hashing, la verificación y el cambio de credenciales mediante una API interna exportada y
acotada. Un proveedor local de Argon2id pertenece a Users; no se crea un módulo compartido de hashing sin un segundo
consumidor real. Users no depende de Auth.

`AuthModule` orquesta registro, inicio de sesión, emisión de tokens y sesiones mediante esa API; posee la persistencia
específica de sesiones. La proyección de respuestas HTTP con Zod debe ser explícita según `serialization.md`: ningún
hash debe llegar a solicitudes, registros o respuestas aunque un resultado interno contenga otros datos.

Las reglas generales de module ownership se definen en `project-structure.md`.

## Estructura

La estructura objetivo de Authentication puede evolucionar hacia:

```text
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── config/
├── decorators/
├── guards/
├── repositories/
└── types/
```

Los directorios deben introducirse únicamente cuando exista código que justifique su responsabilidad.

## Access Tokens

Los Access Tokens utilizan JWT mediante `@nestjs/jwt`.

Deben ser short-lived y contener únicamente las claims necesarias para establecer el principal autenticado.

Las claims base son:

```text
sub
iat
exp
```

Claims adicionales como `iss`, `aud` o `sid` pueden incluirse cuando la estrategia correspondiente lo requiera.

No incluya información sensible ni records completos de usuario.

## Refresh Tokens

Los Refresh Tokens son opaque tokens generados mediante `node:crypto`.

Su estado se mantiene server-side para soportar:

- expiration;
- rotation;
- revocation;
- session management.

Los tokens reutilizables no deben persistirse directamente; debe almacenarse una representación segura.

La persistencia específica de sesiones pertenece a `AuthModule`.

## Password Hashing

Las passwords utilizan Argon2id mediante `argon2`.

Las plain-text passwords no deben persistirse.

`UsersModule` almacena el hash y ejecuta hashing, verificación y cambio de contraseña. También persiste la condición de
cambio obligatorio inicial; Auth consume su API sin acceder al repositorio de Users.

## Request Authentication

Los Endpoints protegidos utilizan un Guard de Access Token.

El Guard es responsable de:

- validar las credentials;
- consultar mediante la API de Users una proyección mínima y segura del estado actual del usuario;
- establecer el principal autenticado sin propagar el registro completo ni el hash.

La autorización no pertenece al Guard de autenticación. Las decisiones de acceso utilizan el estado actual del usuario,
no roles extraídos de las claims del JWT; consulte `authorization.md`.

La estrategia preferida es authentication global con excepciones públicas declaradas explícitamente mediante
`@Public()`.

## AuthenticatedPrincipal

La identidad autenticada se representa mediante un contrato interno independiente de JWT, persistencia y HTTP.

```typescript
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId?: string;
}
```

Los consumidores deben depender de este contrato y no del JWT payload completo.

## Persistencia

`UsersModule` posee la persistencia del usuario.

`AuthModule` posee la persistencia específica del estado de autenticación.

Ambos deben acceder a persistencia mediante las reglas definidas en `data-access.md`.

## Configuración

La configuración de JWT, refresh y sesiones pertenece al boundary de `AuthModule`. Incluye la clave de firma, issuer,
audience y duración de tokens. Los parámetros de Argon2 pertenecen al boundary de credenciales de `UsersModule`.

Su construcción, validación e inyección deben seguir `configuration.md`.

## Reglas

1. Mantenga `AuthModule` separado de `UsersModule`.
2. Utilice JWT mediante `@nestjs/jwt` para Access Tokens.
3. Utilice Argon2id mediante `argon2` para password hashing.
4. Utilice opaque Refresh Tokens con estado server-side.
5. Mantenga el estado de sesiones bajo `AuthModule`.
6. Mantenga los Access Tokens short-lived y sus claims mínimas.
7. Utilice Guards para Request authentication.
8. Mantenga Authentication y Authorization como responsabilidades separadas.
9. Exponga la identidad interna mediante `AuthenticatedPrincipal`.
10. Mantenga `AuthService` independiente de detalles de persistencia y HTTP.
11. Mantenga la configuración JWT y de sesiones en Auth y los parámetros Argon2 en Users.
12. No utilice Passport como dependencia predeterminada.
