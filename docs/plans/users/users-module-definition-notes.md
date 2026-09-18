# Definiciones iniciales del módulo de usuarios

Status: Draft input

Este documento conserva las decisiones iniciales para preparar posteriormente el PRD mínimo de
`UsersModule`. No constituye todavía un PRD, un contrato HTTP definitivo ni una autorización para
implementar el módulo.

## Resultado acordado

El primer módulo de negocio será `UsersModule`. Su implementación precederá a `AuthModule` y
proporcionará temporalmente operaciones de gestión de usuarios sin autenticación, Guards ni reglas
de autorización.

La implementación se dividirá en dos etapas:

1. `UsersModule`, con persistencia y operaciones de gestión de usuarios.
2. `AuthModule`, con registro, autenticación, sesiones, Guards y autorización.

Cuando exista `AuthModule`, dependerá de la API exportada por `UsersModule` y no accederá
directamente a su Repository.

## Alcance inicial de UsersModule

El módulo proporcionará estos casos de uso:

- crear un usuario;
- obtener un usuario por identificador;
- listar usuarios mediante una consulta convencional;
- consultar usuarios mediante criterios estructurados;
- actualizar parcialmente un usuario;
- eliminar un usuario.

Los Endpoints estarán disponibles sin autenticación durante la etapa inicial de desarrollo. Esta
exposición es temporal y deberá revisarse cuando se implemente `AuthModule`.

## Operaciones HTTP propuestas

| Método   | Ruta                    | Responsabilidad                                           |
| -------- | ----------------------- | --------------------------------------------------------- |
| `POST`   | `/api/v1/users`         | Crear un usuario.                                         |
| `GET`    | `/api/v1/users`         | Listar usuarios con paginación y filtros simples.         |
| `QUERY`  | `/api/v1/users`         | Consultar usuarios mediante Request Content estructurado. |
| `GET`    | `/api/v1/users/:userId` | Obtener un usuario por identificador.                     |
| `PATCH`  | `/api/v1/users/:userId` | Actualizar parcialmente un usuario.                       |
| `DELETE` | `/api/v1/users/:userId` | Eliminar un usuario.                                      |

Estas rutas son propuestas de trabajo para el PRD. Sus contratos de Request, Response y Error deben
cerrarse antes de iniciar la implementación.

## Semántica de consulta

`GET /api/v1/users` continuará siendo la operación predeterminada para consultas que puedan
representarse razonablemente mediante Query Params. Incluirá paginación y filtros simples conforme a
`../../api/pagination.md` y `../../api/conventions.md`.

`QUERY /api/v1/users` se reservará para consultas safe e idempotent cuyo input necesite Request
Content, por ejemplo filtros compuestos u ordenamiento estructurado que no resulte práctico expresar
en la URI.

Las dos operaciones de consulta deben permanecer libres de modificaciones y efectos secundarios.

`POST /api/v1/users/search` solo podrá considerarse como fallback temporal si una limitación real
del stack impide publicar `QUERY`. No forma parte del contrato preferido.

La documentación de una operación `QUERY` deberá seguir `../../api/openapi.md`, incluida la decisión
vigente de utilizar OpenAPI 3.2 cuando sea necesario representarla.

## Límite de responsabilidad

`UsersModule` será propietario de:

- los datos y reglas del usuario;
- su modelo de persistencia;
- su Repository privado;
- sus Services y casos de uso;
- sus contratos públicos de Request y Response;
- sus errores de aplicación específicos;
- sus operaciones OpenAPI;
- sus pruebas unitarias y E2E.

Los Controllers delegarán el comportamiento a Services. Los Services accederán a persistencia
mediante el Repository del Feature y no dependerán directamente de Prisma.

Los modelos de Prisma, aplicación y transporte permanecerán separados.

## Fuera del alcance inicial

La primera etapa no implementará:

- registro como flujo de autenticación;
- login o logout;
- passwords o password hashes;
- Access Tokens o Refresh Tokens;
- sesiones;
- `AuthenticatedPrincipal`;
- Guards de autenticación;
- Roles, Permissions o Policies;
- restricciones de acceso sobre las operaciones CRUD.

Estas responsabilidades se definirán e implementarán posteriormente bajo el ownership de
`AuthModule` o de la estrategia de autorización correspondiente.

## Modelo preliminar

Como punto de partida para el PRD se ha propuesto el siguiente modelo público mínimo:

```text
id
email
displayName
createdAt
updatedAt
```

La propuesta asume un email obligatorio, normalizado y único. Este modelo todavía no está aprobado;
el PRD deberá confirmar sus campos, restricciones, nullability y representación pública.

No se añadirán por defecto `username`, teléfono, Roles ni otros datos sin un requisito funcional
explícito.

## Decisiones pendientes para el PRD

Antes de implementar `UsersModule`, el PRD mínimo deberá resolver:

1. Los campos definitivos del usuario y sus reglas de validación.
2. La estrategia de identificadores públicos.
3. La normalización y unicidad del email.
4. La semántica de eliminación: física o lógica.
5. Los filtros y órdenes admitidos por `GET` y `QUERY`.
6. Los contratos de paginación y cursores.
7. Los schemas de Request y Response de cada operación.
8. Los códigos de error específicos y su traducción HTTP.
9. La semántica de creación y actualización ante conflictos de unicidad.
10. Los `operationId` y contratos OpenAPI.
11. La infraestructura PostgreSQL/Prisma y la migración inicial.
12. La estrategia E2E con base de datos temporal aislada y migraciones reales.
13. La transición de los Endpoints no protegidos cuando se incorpore `AuthModule`.

## Restricciones arquitectónicas aplicables

La definición posterior debe respetar:

- `../../architecture/project-structure.md` para ownership y organización del Feature;
- `../../architecture/data-access.md` para PostgreSQL, Prisma y Repositories;
- `../../architecture/authentication.md` para la futura relación entre Auth y Users;
- `../../architecture/validation.md` para contratos de entrada;
- `../../architecture/serialization.md` para contratos de salida;
- `../../architecture/error-handling.md` para errores de aplicación;
- `../../api/conventions.md` para semántica HTTP;
- `../../api/http-contracts.md` para Requests, Responses y errores públicos;
- `../../api/pagination.md` para consultas de colección;
- `../../api/openapi.md` para documentación de operaciones;
- `../../testing/testing.md` y `../../testing/e2e-testing.md` para verificación.

## Próximo paso

Utilizar estas definiciones como entrada para redactar el PRD mínimo de `UsersModule`. El PRD deberá
resolver las decisiones pendientes y convertir las operaciones propuestas en contratos funcionales
verificables antes de comenzar la implementación.
