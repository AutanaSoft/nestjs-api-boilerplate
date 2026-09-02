# Autenticación

Este documento define la arquitectura de autenticación del proyecto.

La autenticación pertenece al Feature `auth` y se mantiene separada de la gestión de usuarios.

## Límite de módulo

La autenticación se ubica en:

```text
src/modules/auth/
```

La gestión de usuarios pertenece a un Feature separado:

```text
src/modules/users/
```

`AuthModule` puede depender de la API pública exportada por `UsersModule`, pero no debe acceder directamente a la
persistencia de usuarios.

```text
AuthService
    ↓
UsersService
    ↓
UsersRepository
```

La persistencia específica de autenticación sigue perteneciendo al Feature de autenticación.

## Responsabilidades

`AuthModule` es responsable de:

- registration flows;
- credential validation;
- login;
- generación y validación de Access Tokens;
- lifecycle de Refresh Tokens;
- Authentication Guards;
- configuración de autenticación.

`UsersModule` es responsable de:

- datos de usuario;
- creación y gestión de usuarios;
- user lookup;
- estado de usuario requerido por otros Features de la aplicación.

Las responsabilidades de autenticación no deben agregarse a `UsersService` simplemente porque la autenticación opera
sobre usuarios.

## Registro

El registro es un caso de uso de autenticación, no una operación CRUD genérica de usuario.

El registration flow debe:

```text
Validate input
    ↓
Check account availability
    ↓
Hash credentials
    ↓
Create user
    ↓
Issue authentication tokens
```

`AuthService` coordina el registration flow, mientras que `UsersService` sigue siendo responsable de la creación de
usuarios.

Las plain-text passwords nunca deben persistirse.

## Login

El login valida las credenciales enviadas y emite authentication tokens.

```text
Credentials
    ↓
Find user
    ↓
Verify password
    ↓
Validate account state
    ↓
Issue tokens
```

Los fallos de autenticación no deben revelar si existe una cuenta, salvo que la API pública requiera explícitamente esa
distinción.

## Password Storage

Las passwords deben procesarse con un password-hashing algorithm diseñado para credential storage.

Persista únicamente el password hash resultante.

```text
Password
   ↓
Password hashing
   ↓
Password hash
   ↓
Persistence
```

Las passwords y los password hashes nunca deben devolverse mediante respuestas de API públicas ni incluirse en
authentication tokens.

## Access Tokens

El proyecto utiliza JWT Access Tokens para Requests autenticados a la API.

Los Access Tokens deben tener una duración corta.

Los JWT payloads deben contener únicamente la información mínima requerida para identificar y validar al authenticated
principal.

La información confidencial no debe almacenarse en los token payloads.

El identificador de usuario debe representarse mediante el claim estándar `sub`.

La token validation debe incluir expiration y las signing constraints configuradas.

## Refresh Tokens

Los Refresh Tokens permiten que los clients obtengan nuevos Access Tokens sin enviar credenciales repetidamente.

Los Refresh Tokens deben tener una duración mayor que los Access Tokens y seguir siendo revocables de forma
independiente.

La persistencia del lado del servidor no debe almacenar credenciales reutilizables de Refresh Tokens en plain text.

Una representación persistida de un token comprometido no debe ser suficiente para autenticarse como el usuario.

La Refresh Token rotation debe invalidar el token utilizado previamente cuando se emite uno nuevo.

## Configuración de tokens

La configuración de autenticación pertenece al Feature `auth`.

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

La configuración debe incluir valores como:

- signing secrets o keys;
- token lifetimes;
- issuer;
- audience.

Los secrets deben ingresar a la aplicación a través del límite de configuración y nunca deben hardcodearse.

## Request Authentication

Las rutas protegidas deben usar NestJS Guards para aplicar la autenticación.

La lógica de autenticación no debe repetirse manualmente dentro de los Controllers.

El authentication boundary debe:

1. extraer el Access Token;
2. validar el token;
3. validar al authenticated principal cuando sea necesario;
4. exponer al authenticated principal al Request context.

Los tokens expirados, inválidos o inaceptables por otros motivos deben resultar en un fallo de autenticación.

## User Validation

Una firma JWT válida por sí sola no garantiza que la cuenta asociada aún deba tener acceso.

La autenticación puede validar adicionalmente el estado relevante de la cuenta, por ejemplo, si el usuario:

- aún existe;
- está activo;
- ha sido deshabilitado;
- ha realizado un cambio de seguridad que invalida tokens emitidos previamente.

Los estados exactos de cuenta admitidos por la aplicación pueden evolucionar independientemente del mecanismo de tokens.

## Límites de seguridad

Las implementaciones de autenticación no deben:

- exponer passwords ni password hashes;
- incluir información confidencial en JWT payloads;
- hardcodear token secrets;
- aceptar tokens expirados;
- almacenar credenciales reutilizables de Refresh Tokens en plain text;
- exponer detalles internos de autenticación mediante Controllers;
- omitir los límites de Features para acceder directamente a la persistencia de usuarios.

## Reglas

1. Mantenga la autenticación y la gestión de usuarios como responsabilidades de Features separados.
2. Coordine el registro mediante `AuthService` mientras delega la gestión de usuarios a `UsersService`.
3. Aplique hashing a las passwords antes de persistirlas y nunca almacene plain-text credentials.
4. Utilice JWT Access Tokens de corta duración.
5. Mantenga los JWT payloads mínimos y sin datos confidenciales.
6. Utilice Refresh Tokens revocables de forma independiente.
7. Almacene de forma segura las representaciones persistidas de Refresh Tokens, en lugar de reusable plain-text tokens.
8. Rote los Refresh Tokens cuando se usen.
9. Mantenga los authentication secrets en una configuración validada propiedad del Feature.
10. Proteja las rutas autenticadas mediante Guards.
11. Valide el estado relevante del usuario durante la autenticación cuando sea necesario.
12. Mantenga la persistencia específica de autenticación dentro del Feature `auth`.
