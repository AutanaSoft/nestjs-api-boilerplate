# Validación

Status: Implemented

Este documento define la estrategia técnica para validar datos que ingresan a la aplicación mediante el límite HTTP. Las
convenciones de los contratos HTTP públicos se definen en `../api/http-contracts.md`.

## Límite de entrada

Todo input externo debe considerarse no confiable hasta haber sido validado. La validación se ejecuta antes de delegar
datos al comportamiento de aplicación, por lo que los Services reciben valores validados y normalizados respecto al
contrato de entrada.

```text
HTTP Request
    ↓
StandardSchemaValidationPipe
    ↓
Request Schema
    ↓
Transformed Typed Input
    ↓
Controller
    ↓
Service
```

## Registro global

`ValidationModule` registra una única instancia global de `StandardSchemaValidationPipe` mediante `APP_PIPE`.
`AppModule` importa ese módulo una sola vez; no se registran pipes equivalentes en `main.ts`, `setupApplication()` ni en
el bootstrap E2E.

El pipe se configura con `transform: true`. El valor que llega al Controller es el resultado validado y transformado por
el schema, no el payload externo original.

## Standard Schema y ownership

El pipe opta por validar solamente los parámetros cuyo decorador declara `metadata.schema`. Los parámetros sin esa
metadata conservan el passthrough nativo; no existe un schema global permisivo.

El schema canónico y sus tipos pertenecen al Feature dueño del endpoint. Cuando un transform cambia el tipo, ese owner
exporta `z.input` y `z.output`; los consumidores no declaran DTOs ni tipos equivalentes paralelos. Los detalles y el
ownership del contrato público pertenecen a `../api/http-contracts.md`.

## Coercion

La coercion debe limitarse a boundaries externos donde la representación de transporte lo requiera. No aplique coercion
innecesariamente sobre valores internos ya tipados.

## Refinements y transforms

Los refinements y transforms ejecutados durante la validación deben ser puros y deterministas. No deben:

- realizar I/O;
- consultar persistencia;
- invocar servicios externos;
- ejecutar autorización;
- depender de estado mutable externo.

Las reglas que necesiten estado de aplicación pertenecen al caso de uso correspondiente.

## Fallos de validación

El pipe crea una `BadRequestException` controlada sin adjuntar issues del schema. El Error Boundary es el único
responsable de traducir esa excepción al contrato público; no propaga la respuesta interna de la excepción. La
clasificación y el contrato de error pertenecen a `error-handling.md` y `../api/http-contracts.md`.

## Reglas

1. Trate todo input externo como no confiable hasta validarlo.
2. Registre un único `APP_PIPE` mediante `ValidationModule`, importado una vez por `AppModule`.
3. Valide únicamente parámetros con `metadata.schema` y entregue su valor transformado al Controller.
4. Mantenga schemas y tipos en su owner canónico, sin DTOs ni tipos paralelos.
5. Limite coercion a boundaries externos.
6. Mantenga refinements y transforms libres de I/O, autorización y estado externo.
7. Delegue contratos HTTP y errores públicos a sus documentos owners.
