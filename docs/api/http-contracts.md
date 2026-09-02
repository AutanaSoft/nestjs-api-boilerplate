# Contratos HTTP

Status: Target

Este documento define las convenciones compartidas de los contratos HTTP públicos de la API.

Los contratos concretos de un Feature pertenecen a su PRD o especificación funcional cuando exista una responsabilidad que justifique mantenerlos allí.

## Alcance

Los contratos HTTP pueden incluir:

- Request Body;
- Query Params;
- Route Params;
- Headers con semántica pública;
- Responses;
- estructuras públicas de colección y metadata;
- Error Responses.

Las convenciones REST generales se definen en `conventions.md`.

La implementación técnica de Request validation y Response serialization se define en `../architecture/validation.md` y `../architecture/serialization.md`.

## Ownership

Cada contrato debe tener un único owner canónico.

Los contratos específicos de un Feature pertenecen al Feature que posee el Endpoint.

Los contratos compartidos deben tener un owner explícito y reutilizarse desde allí.

No mantenga definiciones públicas equivalentes bajo múltiples owners.

## Separación de contratos

Los contratos HTTP son independientes de los modelos internos de aplicación, persistencia e infraestructura.

Compartir campos no convierte esas representaciones en el mismo contrato.

Un cambio interno no debe modificar accidentalmente el contrato público.

## Request y Response

Request y Response son contratos diferentes aunque compartan información.

Cada uno debe modelar únicamente los campos y la semántica que corresponden a su boundary.

Los campos internos no forman parte de una Response pública únicamente porque estén disponibles en el modelo de aplicación o persistencia.

## Nullability y ausencia

La semántica pública debe distinguir explícitamente entre:

- una propiedad omitida;
- una propiedad presente con valor `null`.

La elección debe responder al significado real del contrato y mantenerse consistente entre documentación e implementación.

## Composición

Los contratos compartidos pueden componerse cuando:

- exista un owner reutilizable;
- la composición preserve la semántica pública;
- no introduzca dependencias hacia modelos internos.

No reutilice automáticamente estructuras internas únicamente para reducir duplicación.

## Error Response

Las Responses JSON de error compartidas utilizan:

```typescript
type ErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};
```

`code` debe ser estable y machine-readable.

Los clientes no deben depender de `message` para identificar programáticamente un error.

`details` es opcional y debe contener únicamente información pública correspondiente al error.

El Error Response no debe exponer:

- stack traces;
- errores tecnológicos sin transformar;
- detalles internos de persistencia;
- payloads internos de Providers;
- secrets, tokens o información sensible.

La selección de HTTP Status Codes se define en `conventions.md`.

La traducción entre errores internos y el contrato HTTP se define en `../architecture/error-handling.md`.

## Enforcement y documentación

La estrategia técnica para validar Requests se define en `../architecture/validation.md`.

La estrategia técnica para serializar Responses se define en `../architecture/serialization.md`.

La representación de estos contratos en OpenAPI se define en `openapi.md`.

## Reglas

1. Mantenga un único owner por contrato público.
2. Mantenga separados los contratos HTTP y los modelos internos.
3. Mantenga Request y Response como responsabilidades distintas.
4. Modele explícitamente ausencia y `null`.
5. Componga contratos únicamente cuando se preserve ownership y semántica.
6. No exponga detalles internos únicamente porque formen parte de una representación interna.
7. Utilice `{ statusCode, code, message, requestId, details? }` como Error Response JSON compartido.
8. Mantenga `code` estable y machine-readable.
9. No exponga información tecnológica o sensible mediante Error Responses.
10. Delegue validation, serialization y error translation a sus documentos arquitectónicos owners.
