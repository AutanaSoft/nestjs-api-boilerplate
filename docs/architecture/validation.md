# Validación

Status: Target

Este documento define la estrategia técnica para validar datos que ingresan a la aplicación mediante el límite HTTP.

Las convenciones de los contratos HTTP públicos se definen en `../api/http-contracts.md`.

## Límite de entrada

Todo input externo debe considerarse no confiable hasta haber sido validado.

La validación debe ejecutarse antes de delegar datos al comportamiento de aplicación.

```text
HTTP Request
    ↓
StandardSchemaValidationPipe
    ↓
Request Schema
    ↓
Typed Input
    ↓
Controller
    ↓
Service
```

Los Services deben recibir valores ya validados y normalizados respecto al contrato de entrada.

## Standard Schema

El proyecto utiliza Zod 4 y `StandardSchemaValidationPipe` como estrategia predeterminada de Request validation.

El Pipe debe validar contra el Schema canónico correspondiente y entregar el valor resultante de la validación.

Los detalles y ownership del contrato público pertenecen a `../api/http-contracts.md`.

## Coercion

La coercion debe limitarse a boundaries externos donde la representación de transporte lo requiera.

No aplique coercion innecesariamente sobre valores internos ya tipados.

## Refinements y Transforms

Los Refinements y Transforms ejecutados durante la validación deben ser puros y deterministas.

No deben:

- realizar I/O;
- consultar persistencia;
- invocar servicios externos;
- ejecutar autorización;
- depender de estado mutable externo.

Las reglas que necesiten estado de aplicación pertenecen al caso de uso correspondiente.

## Errores

Los errores propios de Zod, Standard Schema o del Pipe no deben exponerse directamente como contrato público.

Su traducción pertenece al Error Boundary definido en `error-handling.md`.

## Reglas

1. Trate todo input externo como no confiable hasta validarlo.
2. Utilice Zod 4 con `StandardSchemaValidationPipe` como estrategia predeterminada.
3. Valide y normalice el input antes de delegarlo a Services.
4. Limite coercion a boundaries externos.
5. Mantenga Refinements y Transforms libres de I/O, autorización y estado externo.
6. Delegue contratos HTTP y errores públicos a sus documentos owners.
