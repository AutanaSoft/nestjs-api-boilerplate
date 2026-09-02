# OpenAPI

Este documento define las convenciones para generar y mantener la especificación OpenAPI de la API.

## Convención

La especificación OpenAPI debe generarse desde el código mediante `@nestjs/swagger`.

```typescript
const documentFactory = () =>
  SwaggerModule.createDocument(app, config, documentOptions);
```

El documento generado debe representar el contrato HTTP público de la aplicación.

## Source of Truth

Los Request y Response Schemas definidos con Zod son la fuente de verdad para la estructura de datos.

La generación OpenAPI debe reutilizar esos Schemas mediante el soporte de Standard Schema.

```typescript
const documentOptions: SwaggerDocumentOptions = {
  standardSchemaConverter: (schema, { schemaType }) => {
    const converted = createSchema(schema as never, {
      io: schemaType,
      openapiVersion: '3.2.0',
    });

    return {
      schema: converted.schema,
      components: converted.components,
    };
  },
};
```

No duplique manualmente en decorators un Schema que ya exista como contrato Zod.

## Versioning

La especificación debe reflejar las rutas versionadas definidas por la API.

```text
/api/v1/users
/api/v2/users
```

El versionado OpenAPI debe mantenerse consistente con `docs/api/versioning.md`.

## Operations

Todos los Endpoints públicos deben aparecer en la especificación.

Esto incluye los métodos HTTP utilizados por la API:

```text
GET
QUERY
POST
PUT
PATCH
DELETE
```

La especificación debe utilizar OpenAPI 3.2 cuando se documenten Endpoints `QUERY`.

Mientras `@nestjs/swagger` no genere estas operaciones de forma nativa en la versión utilizada por el proyecto, debe incorporarse la operación `query` explícitamente durante la generación del documento OpenAPI.

El soporte de `QUERY` de `@nestjs/swagger` debe verificarse al actualizar la dependencia; cualquier workaround debe eliminarse cuando exista soporte nativo equivalente.

## Security

Los Endpoints protegidos deben reflejar sus requisitos de autenticación mediante los Security Schemes correspondientes.

La especificación no debe presentar como público un Endpoint que requiera autenticación.

## Errors

Los Responses de error documentados deben utilizar el Error Response definido por la arquitectura.

No cree formatos de error diferentes únicamente para la documentación OpenAPI.

## Operation IDs

Cada operación pública debe tener un `operationId` estable y único.

Cambiar un `operationId` puede romper clientes generados y debe tratarse como un cambio contractual cuando exista dependencia externa sobre él.

## Reglas

1. Genere OpenAPI mediante `@nestjs/swagger`.
2. Utilice los Zod Schemas como fuente de verdad para Request y Response contracts.
3. Reutilice Standard Schema para generar los Schemas OpenAPI.
4. No duplique contratos mediante decorators cuando ya estén definidos por Zod.
5. Mantenga OpenAPI consistente con el versionado de la API.
6. Documente todos los Endpoints públicos y sus métodos HTTP.
7. Utilice OpenAPI 3.2 para documentar Endpoints `QUERY` y mantenga cualquier workaround aislado hasta que `@nestjs/swagger` tenga soporte nativo equivalente.
8. Mantenga los Security Schemes consistentes con los requisitos reales de autenticación.
9. Reutilice el Error Response estándar.
10. Utilice `operationId` estable y único para cada operación pública.
11. Mantenga la especificación generada alineada con el comportamiento observable de la API.
