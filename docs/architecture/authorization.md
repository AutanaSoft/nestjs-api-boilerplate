# Autorización

Este documento define las convenciones de autorización para controlar qué operaciones puede ejecutar un principal autenticado sobre los recursos de la aplicación.

La autorización es independiente de la autenticación.

La autenticación determina quién realiza el Request.

La autorización determina qué puede hacer ese principal.

```text
Authentication
      ↓
Authenticated Principal
      ↓
Authorization
      ↓
Allowed Operation
```

Una Request autenticada no debe considerarse automáticamente autorizada.

## Límite de autorización

Las decisiones de autorización deben ejecutarse después de establecer la identidad del principal y antes de ejecutar una operación protegida.

```text
HTTP Request
    ↓
Authentication Guard
    ↓
Authenticated Principal
    ↓
Authorization Guard / Policy
    ↓
Controller
    ↓
Service
```

La autorización debe impedir que una operación no permitida alcance exitosamente la lógica de aplicación protegida.

Los Controllers no deben repetir manualmente comprobaciones equivalentes de permisos en cada Endpoint.

## Principal autenticado

El Authentication Boundary debe exponer un principal autenticado con la información mínima necesaria para las decisiones posteriores.

Por ejemplo:

```typescript
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly roles?: readonly Role[];
  readonly permissions?: readonly Permission[];
}
```

La forma concreta puede evolucionar según los requisitos del proyecto.

El principal no debe contener información sensible innecesaria ni depender directamente de un record completo de Prisma.

## 401 y 403

La aplicación debe distinguir consistentemente autenticación y autorización.

### 401 Unauthorized

Utilice:

```text
401 Unauthorized
```

cuando la Request no pueda establecer un principal autenticado válido.

Ejemplos:

- Access Token ausente en un Endpoint protegido;
- Access Token inválido;
- Access Token expirado;
- principal asociado al token ya no aceptable.

### 403 Forbidden

Utilice:

```text
403 Forbidden
```

cuando exista un principal autenticado válido pero no tenga autorización para ejecutar la operación solicitada.

Ejemplos:

- falta un Permission requerido;
- el Role no permite la operación;
- el principal no puede modificar ese recurso;
- una Policy rechaza la acción.

No utilice `401` para representar falta de permisos de un usuario correctamente autenticado.

## Estrategia de autorización

La arquitectura no debe obligar a utilizar una única estrategia para todos los proyectos.

Según los requisitos de la aplicación, la autorización puede basarse en:

- Roles;
- Permissions;
- Policies;
- ownership de recursos;
- atributos del principal;
- atributos del recurso;
- combinación de los anteriores.

La complejidad del mecanismo debe crecer con los requisitos reales.

Una aplicación sencilla puede utilizar Roles.

Una aplicación con operaciones más específicas puede utilizar Permissions.

Una aplicación con reglas contextuales puede requerir Policies.

## Roles

Los Roles representan categorías amplias de responsabilidad o acceso.

Por ejemplo:

```typescript
export enum Role {
  User = 'user',
  Admin = 'admin',
}
```

Los Roles pueden ser apropiados para restricciones generales como:

```text
Admin
  ↓
Administrar usuarios
```

Evite multiplicar Roles únicamente para representar cada operación individual.

Un Role no debe convertirse en un sustituto de Permissions cuando la aplicación necesite control granular.

## Permissions

Los Permissions representan capacidades específicas.

Por ejemplo:

```typescript
export enum Permission {
  UsersRead = 'users:read',
  UsersCreate = 'users:create',
  UsersUpdate = 'users:update',
  UsersDelete = 'users:delete',
}
```

Los Permissions deben usar nombres estables y expresar una capacidad, no una implementación técnica.

Una convención recomendada es:

```text
<resource>:<action>
```

Por ejemplo:

```text
users:read
users:create
users:update
users:delete
orders:read
orders:update
```

Los Permission names forman parte de la semántica de autorización y deben mantenerse consistentes.

## Roles y Permissions

Cuando ambos conceptos existan, los Roles deben agrupar Permissions en lugar de obligar a los Endpoints a conocer todos los detalles de esa relación.

```text
Role
  ↓
Permissions
  ↓
Authorization Decision
```

Por ejemplo:

```text
Admin
  ↓
users:read
users:create
users:update
users:delete
```

Los Endpoints deberían declarar la capacidad requerida:

```text
users:update
```

en lugar de depender innecesariamente de:

```text
Admin
```

cuando la regla real sea una capacidad específica.

Esto permite que la asignación de Roles cambie sin alterar el contrato de autorización de cada Endpoint.

## Metadata declarativa

Los requisitos de autorización HTTP deben declararse de forma explícita y cercana al Endpoint.

Por ejemplo:

```typescript
@RequirePermissions(Permission.UsersUpdate)
@Patch(':id')
updateUser() {}
```

La metadata debe expresar qué requisito existe.

El Guard correspondiente debe interpretar esa metadata y decidir si la Request puede continuar.

```text
Endpoint Metadata
      ↓
Authorization Guard
      ↓
Authenticated Principal
      ↓
Allow / Deny
```

Evite checks dispersos como:

```typescript
if (!request.user.roles.includes('admin')) {
  throw new ForbiddenException();
}
```

dentro de múltiples Controllers.

## Authorization Guards

Los Guards son el mecanismo predeterminado para autorización declarativa asociada al contexto HTTP.

Un Authorization Guard puede utilizar:

- metadata del handler;
- metadata del Controller;
- principal autenticado;
- Roles;
- Permissions;
- Policies.

El Guard debe devolver o producir una decisión de acceso clara.

Un rechazo de autorización de un principal autenticado debe traducirse a:

```text
403 Forbidden
```

mediante el Error Boundary establecido por la aplicación.

## Global Authorization

La aplicación puede registrar Guards globales cuando exista una política predeterminada suficientemente clara.

Una estrategia posible es:

```text
Authenticated by default
Public only when explicitly declared
```

En este modelo, los Endpoints públicos deben declararse explícitamente mediante metadata, por ejemplo:

```typescript
@Public()
@Post('login')
login() {}
```

Esto reduce el riesgo de publicar accidentalmente un Endpoint que debía estar protegido.

La metadata `@Public()` debe representar únicamente que un Endpoint no requiere autenticación.

No debe utilizarse para omitir otras medidas de seguridad que puedan aplicar al Endpoint.

## Public Endpoints

Los Endpoints públicos deben ser explícitos.

Ejemplos habituales:

- login;
- registration cuando esté habilitado;
- health checks públicos cuando así se decida;
- callbacks específicos que utilicen otro mecanismo de autenticación.

No asuma que un Endpoint es público simplemente porque no tiene un Guard local visible.

Cuando la aplicación utilice autenticación global, la excepción pública debe estar declarada explícitamente.

## Policies

Los Permissions simples no siempre pueden representar reglas dependientes del contexto.

Por ejemplo:

```text
El usuario puede actualizar su propio perfil.
```

Esta regla depende tanto de:

```text
principal.userId
```

como del recurso solicitado.

Este tipo de autorización puede modelarse mediante una Policy.

```text
Principal
    +
Action
    +
Resource
    ↓
Policy
    ↓
Allow / Deny
```

Una Policy debe expresar una decisión de autorización, no ejecutar el caso de uso completo.

## Resource Ownership

El ownership de recursos es una forma común de autorización contextual.

Ejemplo:

```text
principal.userId === profile.userId
```

No debe asumirse que conocer un identificador de recurso implica autorización para acceder a él.

```text
GET /users/:id
```

debe aplicar las reglas de acceso correspondientes incluso cuando el `id` sea válido.

## Dónde resolver Resource Ownership

Cuando una decisión requiera cargar datos persistidos, no debe forzarse toda la lógica dentro de un Guard si eso genera acceso a persistencia duplicado o arquitectura difícil de mantener.

Existen dos tipos de autorización:

### Pre-resource Authorization

Puede resolverse antes de cargar el recurso.

Ejemplo:

```text
Permission: users:create
```

Es apropiada para un Guard declarativo.

### Resource-dependent Authorization

Requiere conocer el recurso.

Ejemplo:

```text
El usuario puede editar únicamente sus propios documentos.
```

Puede requerir:

```text
Service
   ↓
Load Resource
   ↓
Authorization Policy
   ↓
Continue Operation
```

La autorización sigue siendo obligatoria, pero la ubicación concreta debe respetar el boundary del caso de uso.

No realice una query en un Guard y luego repita la misma query en el Service únicamente para mantener artificialmente toda autorización en Guards.

## Authorization dentro de Services

Los Services no deben contener checks HTTP como:

```typescript
throw new ForbiddenException();
```

Sin embargo, una operación de aplicación puede necesitar aplicar una Policy dependiente del recurso.

Por ejemplo:

```typescript
const order = await this.repository.findById(id);

if (!this.orderPolicy.canUpdate(principal, order)) {
  throw new OperationNotAllowedError();
}
```

El Application Error resultante continúa siendo independiente de HTTP.

El Error Boundary puede traducirlo posteriormente a `403 Forbidden`.

## Policies como componentes

Las Policies deben permanecer enfocadas en decisiones de acceso.

Por ejemplo:

```typescript
@Injectable()
export class OrderPolicy {
  canUpdate(
    principal: AuthenticatedPrincipal,
    order: Order,
  ): boolean {
    return (
      principal.permissions.includes(Permission.OrdersUpdateAny) ||
      order.ownerId === principal.userId
    );
  }
}
```

Una Policy no debe:

- enviar Responses HTTP;
- acceder directamente a Request/Response;
- lanzar `HttpException` como mecanismo normal;
- ejecutar workflows completos;
- modificar el recurso evaluado.

## Deny by Default

Cuando una operación declare requisitos de autorización, la ausencia de evidencia suficiente debe producir rechazo.

```text
Unknown permission state
        ↓
Deny
```

No autorice una operación porque falten datos para comprobar la Policy.

Una autorización incompleta debe fallar de forma segura.

## Authorization y JWT

El JWT puede contener información útil para autorización, pero no debe convertirse automáticamente en la única fuente de verdad para permisos que puedan cambiar durante la vida del token.

Ejemplos:

```text
roles
permissions
securityVersion
```

La estrategia debe considerar cuánto tiempo pueden permanecer válidas esas claims y si los cambios de autorización requieren efecto inmediato.

Para datos que necesiten revocación o cambios inmediatos, puede ser necesario consultar estado actual del usuario o mantener mecanismos de invalidación.

El JWT debe continuar siendo mínimo y evitar información innecesaria.

## No confiar en input del cliente

El cliente nunca debe decidir sus propios Roles, Permissions u ownership.

No utilice valores provenientes de:

- Request Body;
- Query Params;
- Route Params;
- Headers arbitrarios;

como fuente confiable de autorización.

Por ejemplo, esto no es válido:

```json
{
  "userId": "other-user",
  "role": "admin"
}
```

para establecer identidad o privilegios.

La autorización debe derivarse del principal autenticado y de estado confiable de aplicación.

## Filtrado de datos y autorización

La autorización no sólo afecta si una operación puede ejecutarse.

También puede afectar qué información puede visualizar el principal.

Por ejemplo:

```text
UserResponse
AdminUserResponse
```

pueden representar contratos distintos.

La decisión sobre qué datos están permitidos debe resolverse antes de la serialización.

`StandardSchemaSerializerInterceptor` garantiza el Response Contract seleccionado, pero no decide qué contrato está autorizado para un principal.

```text
Authorization Decision
        ↓
Allowed Application Result
        ↓
Response Schema
        ↓
HTTP Response
```

No utilice la serialización como sustituto de autorización.

## Enumeración de recursos

En algunos casos, revelar que un recurso existe puede representar una filtración de información.

Por ejemplo, una aplicación puede decidir responder:

```text
404 Not Found
```

en lugar de:

```text
403 Forbidden
```

cuando un principal no debe saber que el recurso existe.

Esta debe ser una decisión explícita del caso de uso o de la política de seguridad.

No mezcle `403` y `404` arbitrariamente entre Endpoints equivalentes.

La regla general continúa siendo:

```text
Authenticated but not authorized → 403
```

salvo que una política documentada requiera ocultar la existencia del recurso.

## Logging

Los rechazos normales de autorización no deben producir automáticamente logs con nivel `error`.

Eventos relevantes para seguridad pueden producir structured logs cuando sea útil.

Ejemplos:

- repetidos intentos de acceso prohibido;
- intentos administrativos no autorizados;
- anomalías de permisos;
- cambios de Roles o Permissions.

Los logs deben seguir las reglas globales de observabilidad y no incluir tokens, credentials ni datos sensibles completos.

## Testing

La autorización debe probarse en varios niveles.

### Unit Tests

Utilice Unit Tests para:

- Policies;
- resolución de Permissions;
- mapping de Roles a Permissions;
- reglas de ownership;
- casos permitidos y denegados.

### E2E Tests

Los E2E Tests deben verificar el comportamiento público real.

Deben incluir, cuando corresponda:

```text
No credentials        → 401
Invalid credentials   → 401
Authenticated allowed → success
Authenticated denied  → 403
```

También deben probar:

- ownership permitido;
- ownership denegado;
- Endpoints públicos;
- ausencia de bypass entre Features;
- Responses que no expongan datos no autorizados.

Las pruebas deben utilizar autenticación real según las convenciones E2E del proyecto.

## Reglas

1. Mantenga autenticación y autorización como responsabilidades independientes.
2. Ejecute autorización después de establecer un principal autenticado y antes de completar una operación protegida.
3. Utilice `401 Unauthorized` cuando no pueda establecerse un principal válido.
4. Utilice `403 Forbidden` cuando un principal válido carezca de autorización.
5. Mantenga Roles, Permissions y Policies como conceptos explícitos cuando los requisitos los necesiten.
6. Prefiera Permissions para capacidades específicas y Roles como agrupaciones cuando ambos modelos existan.
7. Declare los requisitos HTTP mediante metadata y Guards cuando puedan resolverse antes de cargar el recurso.
8. Mantenga los Endpoints públicos explícitamente marcados cuando exista protección global.
9. Utilice Policies para autorización contextual o dependiente del recurso.
10. No duplique acceso a persistencia sólo para forzar autorización dependiente del recurso dentro de un Guard.
11. Mantenga `HttpException` fuera de Services y Policies como representación general de autorización.
12. Represente rechazos de aplicación mediante Application Errors cuando la decisión ocurra dentro del caso de uso.
13. No confíe en Roles, Permissions o identidad proporcionados arbitrariamente por el cliente.
14. Aplique deny-by-default cuando no exista información suficiente para autorizar.
15. No utilice Response serialization como sustituto de autorización.
16. Mantenga las claims JWT mínimas y considere su vigencia cuando Roles o Permissions puedan cambiar.
17. Documente explícitamente cualquier política que utilice `404` para ocultar la existencia de recursos no autorizados.
18. Utilice structured logging para eventos de seguridad relevantes sin registrar datos sensibles.
19. Cubra Roles, Permissions, Policies y ownership mediante Unit Tests cuando corresponda.
20. Verifique `401`, `403`, acceso permitido y resource ownership mediante E2E Tests.
