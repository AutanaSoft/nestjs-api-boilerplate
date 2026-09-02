# Descripción general de la arquitectura

Status: Target

Este documento define la arquitectura de alto nivel para las aplicaciones creadas a partir de este template.

## Objetivos

El template proporciona una base reutilizable para construir APIs HTTP con NestJS y TypeScript.

La arquitectura debe:

- permanecer simple para aplicaciones pequeñas;
- permitir crecimiento incremental por Feature;
- mantener ownership y dependencias explícitos;
- separar comportamiento de aplicación e infraestructura;
- proporcionar una base mantenible, segura y verificable.

Los requisitos funcionales de Features concretos no pertenecen a este documento.

## Constraints

La arquitectura parte de las siguientes restricciones:

- NestJS 12 y TypeScript como plataforma de aplicación;
- Node.js 26 o superior como runtime soportado;
- pnpm como package manager del proyecto;
- aplicación HTTP modular basada en el sistema de Modules y Providers de NestJS.

Las decisiones tecnológicas específicas de cada responsabilidad transversal se mantienen en sus documentos owners.

## Context & Scope

El sistema es un template para construir una API HTTP.

Su arquitectura cubre:

- estructura de la aplicación;
- límites entre Features;
- dependencias internas;
- integración con infraestructura;
- conceptos técnicos transversales.

Los clientes HTTP y sistemas externos interactúan con la aplicación mediante boundaries explícitos.

Las reglas del contrato HTTP público se mantienen en `../api/`.

## Solution Strategy

Las capacidades de aplicación se organizan mediante Feature Modules con ownership explícito.

Cada Feature mantiene sus componentes específicos y expone únicamente las capacidades requeridas por otros módulos.

La colaboración entre Features se realiza mediante imports y exports de NestJS, evitando dependencias directas sobre detalles internos.

La estructura estática objetivo se define en `project-structure.md`.

### Responsabilidades

Controllers, Services, Repositories y otros Providers deben mantener responsabilidades cohesivas.

La complejidad interna de un Feature puede crecer cuando sus requisitos lo justifiquen sin alterar el modelo arquitectónico general.

### Persistencia

Los detalles de persistencia permanecen separados del comportamiento de aplicación.

La estrategia completa se define en `data-access.md`.

### Infraestructura

La infraestructura transversal permanece fuera de los Feature Modules y proporciona capacidades técnicas sin asumir ownership funcional.

La estrategia de configuración se define en `configuration.md`.

### Dependencias

La dirección conceptual de dependencias es:

```text
Transport
   ↓
Application
   ↓
Persistence
   ↓
Infrastructure
```

Entre Features, las dependencias deben atravesar APIs de módulos expuestas explícitamente.

Los detalles de implementación de niveles inferiores no deben propagarse hacia responsabilidades de aplicación de nivel superior.

### Complejidad incremental

La arquitectura introduce estructura únicamente cuando existe una responsabilidad que la justifique.

No requiere aplicar de forma completa Clean Architecture, Hexagonal Architecture, Domain-Driven Design u otro modelo formal.

Patrones adicionales pueden incorporarse cuando mejoren límites o mantenibilidad y su complejidad esté justificada.

## Building Blocks

Los building blocks principales son:

```text
Application
├── Feature Modules
└── Shared Infrastructure
```

Los Feature Modules poseen capacidades de aplicación.

Shared Infrastructure proporciona capacidades técnicas transversales.

La descomposición estática detallada y las reglas de module ownership se definen en `project-structure.md`.

## Quality Requirements

Las decisiones arquitectónicas deben favorecer:

- **Simplicity**: evitar estructura o abstracciones sin una responsabilidad real.
- **Maintainability**: mantener responsabilidades y ownership explícitos.
- **Evolvability**: permitir que Features crezcan de forma independiente.
- **Security**: conservar los boundaries y controles técnicos definidos por el proyecto.
- **Testability**: permitir verificar componentes en el límite adecuado sin depender innecesariamente de infraestructura.

Las estrategias específicas de seguridad, testing y otros conceptos transversales pertenecen a sus documentos owners.
