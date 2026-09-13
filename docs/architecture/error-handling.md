# Manejo de errores

Status: Target

Este documento define la estrategia arquitectónica para representar errores internos y traducirlos
en los boundaries de la aplicación.

La semántica pública de HTTP Status Codes se define en `../api/conventions.md`.

El contrato público de Error Response se define en `../api/http-contracts.md`.

## Error Boundary

La traducción hacia el transport debe centralizarse mediante un global Exception Filter o Error
Boundary equivalente.

```text
Application / Infrastructure Error
            ↓
      HTTP Error Boundary
            ↓
    Public Error Contract
```

Los Controllers no deben repetir mappings de errores que puedan resolverse en el Error Boundary.

## Rutas sin coincidencia

`NotFoundController` usa el catch-all versionado de Nest `@All('{*path}')` para rutas sin
coincidencia. Las rutas específicas conservan prioridad; el controlador lanza `NotFoundException`
para que el Error Boundary central emita `ROUTE_NOT_FOUND`. Para observabilidad, este patrón técnico
se normaliza como `unmatched` en los logs.

## Application Errors

Las condiciones esperadas del comportamiento de aplicación deben representarse mediante una clase
base abstracta `ApplicationError` que extienda `Error`.

`ApplicationErrorCode` es una unión cerrada. Cada subclase tipada declara uno de esos códigos y solo
el contexto interno mínimo necesario para la aplicación. No contiene status HTTP, mensajes públicos,
objetos Request o Response ni clases de NestJS.

La causa opcional (`cause`) se conserva exclusivamente para diagnóstico interno; nunca cruza el
Error Boundary. Los Services no deben necesitar conocer qué representación HTTP corresponderá
posteriormente a estos errores.

No utilice `HttpException` como mecanismo general para representar condiciones de aplicación dentro
de Services.

## Catálogo y traducción HTTP

El HTTP Error Boundary es el único responsable de convertir un `ApplicationError` al catálogo
público propiedad de `../api/http-contracts.md`. El catálogo de implementación es tipado, inmutable
y exhaustivo: debe satisfacer `Record<ApplicationErrorCode, HttpErrorDescriptor>` para que cada
código interno tenga una traducción explícita.

El descriptor público, incluidos status, código, mensaje y un proyector opcional de `details`,
pertenece al boundary. `details` se omite salvo que ese descriptor disponga de un proyector
explícito y tipado; el error original y valores `unknown` no son datos serializables.

Las `HttpException` del framework se aceptan únicamente mediante una allowlist de casos con
traducción pública aprobada. El boundary siempre reconstruye el Error Response y nunca propaga
`exception.getResponse()` ni su body. Una excepción fuera de la allowlist se trata como fallo
interno.

`ErrorHandlingModule` es el módulo transversal que registra una única instancia de
`HttpExceptionFilter` mediante `APP_FILTER`. `AppModule` lo importa una sola vez, de modo que NestJS
resuelve las dependencias del filtro por DI tanto en producción como en E2E.

## Traducción entre boundaries

Los errores tecnológicos deben traducirse cuando su significado tenga semántica para la aplicación.

```text
Technology Error
      ↓
Boundary Translation
      ↓
Application Error
      ↓
HTTP Error Boundary
```

Los detalles específicos de una tecnología no deben propagarse fuera del boundary que la integra.

No todo fallo de infraestructura requiere un Application Error específico. Los errores inesperados
pueden propagarse hasta el Error Boundary y tratarse como errores internos.

## Validation Errors

Los errores producidos durante Request validation deben alcanzar el Error Boundary mediante una
representación controlada.

Los detalles propios de Zod, Standard Schema o del mecanismo de validación no deben convertirse
directamente en el contrato público.

La estrategia de Request validation se define en `validation.md`.

La representación HTTP pública se rige por `../api/conventions.md` y `../api/http-contracts.md`.

## Response Contract Errors

Un fallo al validar o serializar una Response representa un incumplimiento interno del contrato de
salida. Se clasifica internamente como `ResponseContractViolation`, sin status, código ni mensaje
HTTP.

No debe atribuirse al cliente.

La estrategia de Response serialization se define en `serialization.md`.

La traducción hacia el contrato HTTP público pertenece al Error Boundary.

## Unknown Errors

Los valores capturados en `catch` deben tratarse como `unknown` hasta realizar narrowing.

```typescript
try {
  await operation();
} catch (error: unknown) {
  // narrow before reading error properties
}
```

Un error desconocido que alcance el Error Boundary debe tratarse como un fallo interno y producir
una representación pública segura.

## Observabilidad

Los errores inesperados deben proporcionar suficiente contexto interno para diagnóstico sin alterar
el contrato público ni exponer información sensible.

Logging, request correlation y telemetry se definen en `observability.md`.

## Reglas

1. Mantenga separados los errores internos y su representación HTTP pública.
2. Utilice Application Errors independientes del transport para condiciones esperadas.
3. Centralice la traducción hacia HTTP mediante un Error Boundary.
4. Mantenga `HttpException` fuera de Services como mecanismo general de errores de aplicación.
5. Traduzca errores tecnológicos dentro del boundary que los integra cuando tengan semántica de
   aplicación.
6. No propague detalles tecnológicos hacia contratos externos.
7. Trate fallos de Response contracts como errores internos.
8. Trate valores capturados en `catch` como `unknown` hasta realizar narrowing.
9. Mantenga el catálogo de implementación exhaustivo, inmutable y confinado al HTTP Error Boundary.
10. Reconstruya las respuestas de excepciones HTTP solo desde la allowlist aprobada.
11. Registre el filtro global una única vez mediante `ErrorHandlingModule` y `APP_FILTER`.
12. Delegue HTTP Status Codes y Error Responses a sus documentos API owners.
13. Mantenga logging y telemetry bajo las convenciones de observabilidad.
14. Para rutas sin coincidencia, mantenga el catch-all versionado, preserve la prioridad de rutas
    específicas y delegue su respuesta pública al Error Boundary.
