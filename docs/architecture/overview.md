# Descripción general de la arquitectura

El proyecto sigue una arquitectura de aplicación modular construida alrededor de límites explícitos de Features.

La arquitectura está diseñada para mantenerse simple en APIs pequeñas, a la vez que permite que cada Feature crezca sin
requerir una reestructuración de todo el repositorio.

## Modelo arquitectónico

Las capacidades de la aplicación se implementan como Feature Modules independientes de NestJS.

Cada módulo es responsable de un área funcional cohesiva y expone únicamente las capacidades que otros módulos requieren.

Los módulos colaboran mediante imports y exports explícitos de NestJS, en lugar de compartir detalles internos de
implementación.

## Principios

### Feature Ownership

El comportamiento de la aplicación pertenece al Feature responsable de él.

Un Feature mantiene bajo su responsabilidad su transport, lógica de aplicación, acceso a persistencia, contratos y
componentes de soporte, salvo que una responsabilidad sea genuinamente compartida en toda la aplicación.

### Límites explícitos

Las dependencias entre módulos deben ser visibles mediante module imports y Providers exportados.

Los Providers internos deben permanecer privados, salvo que otro módulo tenga una razón concreta para consumirlos.

### Responsabilidad única

Controllers, Services, Repositories y otros Providers deben tener responsabilidades cohesivas.

Los componentes deben dividirse cuando comiencen a asumir comportamientos no relacionados, en lugar de crecer hasta
convertirse en clases de propósito general.

### Aislamiento de persistencia

Los Application Services no deben depender directamente de APIs específicas del ORM.

El comportamiento de persistencia se aísla detrás de Repositories, de modo que los detalles de implementación de la base
de datos permanezcan fuera de la lógica de aplicación.

### Separación de infraestructura

La infraestructura transversal, como la conectividad de la base de datos y la configuración de la aplicación, se
mantiene separada de los Feature Modules de la aplicación.

La infraestructura da soporte a los Features, pero no define sus responsabilidades de aplicación.

### Complejidad incremental

La estructura arquitectónica debe crecer según los requisitos reales de la aplicación.

Los Features pequeños pueden mantenerse simples. Los Features más grandes pueden introducir Controllers, Services,
Repositories u organización interna adicionales sin cambiar el modelo arquitectónico general.

### Independencia tecnológica

La arquitectura estructural no debe depender innecesariamente de una base de datos, ORM, estrategia de autenticación o
Provider externo específico.

Las decisiones específicas de tecnología deben respetar los límites arquitectónicos definidos por el proyecto.

## Dirección de las dependencias

El flujo de dependencias típico es:

```text
Transport
   ↓
Application
   ↓
Persistence
   ↓
Infrastructure
```

Las dependencias deben preservar estos límites e impedir que los detalles de implementación de nivel inferior se filtren
hacia responsabilidades de aplicación de nivel superior.

Entre Features, las dependencias deben pasar por APIs de módulos expuestas explícitamente.

## Alcance arquitectónico

Esta arquitectura define las convenciones predeterminadas para las aplicaciones creadas a partir de este template.

No aplica por completo Clean Architecture, Hexagonal Architecture, Domain-Driven Design ni otra arquitectura formal.

Se pueden adoptar patrones de esos enfoques cuando mejoren los límites, la mantenibilidad o la capacidad de prueba. La
complejidad arquitectónica adicional debe justificarse mediante los requisitos de la aplicación.
