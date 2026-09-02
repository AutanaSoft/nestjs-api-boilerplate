# Autenticación

Este documento define la arquitectura de autenticación para el Boilerplate de API de NestJS.

La autenticación es propiedad de la funcionalidad `auth` y se mantiene separada de la gestión de usuarios.

## Límite de módulo

La autenticación se ubica en:

```text
src/modules/auth/
```

La gestión de usuarios pertenece a una funcionalidad separada:

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

La persistencia específica de autenticación sigue siendo propiedad de la funcionalidad de autenticación.

## Responsabilidades

`AuthModule` es propietario de:

- flujos de registro;
- validación de credenciales;
- inicio de sesión;
- generación y validación de tokens de acceso;
- ciclo de vida de tokens de actualización;
- guards de autenticación;
- configuración de autenticación.

`UsersModule` es propietario de:

- datos de usuario;
- creación y gestión de usuarios;
- búsqueda de usuarios;
- estado de usuario requerido por otras funcionalidades de la aplicación.

Las responsabilidades de autenticación no deben agregarse a `UsersService` simplemente porque la autenticación opera
sobre usuarios.

## Registro

El registro es un caso de uso de autenticación, no una operación CRUD de usuario genérica.

El flujo de registro debe:

```text
Validar entrada
    ↓
Comprobar disponibilidad de la cuenta
    ↓
Aplicar hash a las credenciales
    ↓
Crear usuario
    ↓
Emitir tokens de autenticación
```

`AuthService` coordina el flujo de registro, mientras que `UsersService` sigue siendo responsable de la creación de
usuarios.

Las contraseñas de texto plano nunca deben persistirse.

## Inicio de sesión

El inicio de sesión valida las credenciales enviadas y emite tokens de autenticación.

```text
Credenciales
    ↓
Buscar usuario
    ↓
Verificar contraseña
    ↓
Validar estado de la cuenta
    ↓
Emitir tokens
```

Los fallos de autenticación no deben revelar si existe una cuenta, salvo que la API pública requiera explícitamente esa
distinción.

## Almacenamiento de contraseñas

Las contraseñas deben procesarse con un algoritmo de hash de contraseñas diseñado para el almacenamiento de
credenciales.

Persista únicamente el hash de contraseña resultante.

```text
Contraseña
   ↓
Hash de contraseña
   ↓
Hash de contraseña
   ↓
Persistencia
```

Las contraseñas y los hashes de contraseñas nunca deben devolverse mediante respuestas de API públicas ni incluirse en
tokens de autenticación.

## Tokens de acceso

El proyecto utiliza tokens de acceso JWT para solicitudes de API autenticadas.

Los tokens de acceso deben tener una duración corta.

Las cargas útiles de JWT deben contener únicamente la información mínima requerida para identificar y validar al
principal autenticado.

La información confidencial no debe almacenarse en las cargas útiles de los tokens.

El identificador de usuario debe representarse mediante el claim estándar `sub`.

La validación de tokens debe incluir la expiración y las restricciones de firma configuradas.

## Tokens de actualización

Los tokens de actualización permiten que los clientes obtengan nuevos tokens de acceso sin enviar credenciales
repetidamente.

Los tokens de actualización deben tener una duración mayor que los tokens de acceso y seguir siendo revocables de forma
independiente.

La persistencia del lado del servidor no debe almacenar credenciales reutilizables de tokens de actualización en texto
plano.

Una representación de token persistida comprometida no debe ser suficiente para autenticarse como el usuario.

La rotación de tokens de actualización debe invalidar el token utilizado previamente cuando se emite uno nuevo.

## Configuración de tokens

La configuración de autenticación pertenece a la funcionalidad `auth`.

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

La configuración debe incluir valores como:

- secretos o claves de firma;
- duraciones de tokens;
- emisor;
- audiencia.

Los secretos deben ingresar a la aplicación a través del límite de configuración y nunca deben codificarse de forma
rígida.

## Autenticación de solicitudes

Las rutas protegidas deben usar guards de NestJS para aplicar la autenticación.

La lógica de autenticación no debe repetirse manualmente dentro de los controladores.

El límite de autenticación debe:

1. extraer el token de acceso;
2. validar el token;
3. validar al principal autenticado cuando sea necesario;
4. exponer al principal autenticado al contexto de la solicitud.

Los tokens expirados, inválidos o inaceptables por otros motivos deben resultar en un fallo de autenticación.

## Validación de usuarios

Una firma JWT válida por sí sola no garantiza que la cuenta asociada aún deba tener acceso.

La autenticación puede validar adicionalmente el estado relevante de la cuenta, por ejemplo, si el usuario:

- aún existe;
- está activo;
- ha sido deshabilitado;
- ha realizado un cambio de seguridad que invalida tokens emitidos previamente.

Los estados exactos de cuenta admitidos por la aplicación pueden evolucionar independientemente del mecanismo de tokens.

## Límites de seguridad

Las implementaciones de autenticación no deben:

- exponer contraseñas ni hashes de contraseñas;
- incluir información confidencial en las cargas útiles de JWT;
- codificar de forma rígida secretos de tokens;
- aceptar tokens expirados;
- almacenar credenciales de actualización reutilizables en texto plano;
- exponer elementos internos de autenticación mediante los controladores;
- omitir los límites de funcionalidades para acceder directamente a la persistencia de usuarios.

## Reglas

1. Mantenga la autenticación y la gestión de usuarios como responsabilidades de funcionalidades separadas.
2. Coordine el registro mediante `AuthService` mientras delega la gestión de usuarios a `UsersService`.
3. Aplique hash a las contraseñas antes de persistirlas y nunca almacene credenciales de texto plano.
4. Utilice tokens de acceso JWT de corta duración.
5. Mantenga las cargas útiles de JWT mínimas y sin datos confidenciales.
6. Utilice tokens de actualización revocables de forma independiente.
7. Almacene de forma segura las representaciones de persistencia de tokens de actualización, en lugar de tokens
   reutilizables de texto plano.
8. Rote los tokens de actualización cuando se usen.
9. Mantenga los secretos de autenticación en una configuración validada propiedad de la funcionalidad.
10. Proteja las rutas autenticadas mediante guards.
11. Valide el estado relevante del usuario durante la autenticación cuando sea necesario.
12. Mantenga la persistencia específica de autenticación dentro de la funcionalidad `auth`.
