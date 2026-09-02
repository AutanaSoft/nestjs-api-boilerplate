# Descripción general de la arquitectura

El Boilerplate de API de NestJS sigue una arquitectura de aplicación modular construida alrededor de límites explícitos
de funcionalidades.

La arquitectura está diseñada para mantenerse simple en API pequeñas, a la vez que permite que las funcionalidades
individuales crezcan sin requerir una reestructuración de todo el repositorio.

## Modelo arquitectónico

Las capacidades de la aplicación se implementan como módulos de funcionalidades independientes de NestJS.

Cada módulo es propietario de un área funcional cohesiva y expone únicamente las capacidades que otros módulos
requieren.

Los módulos colaboran mediante importaciones y exportaciones explícitas de NestJS, en lugar de detalles internos de
implementación compartidos.

## Principios

### Propiedad de funcionalidades

El comportamiento de la aplicación pertenece a la funcionalidad responsable de él.

Una funcionalidad es propietaria de su transporte, lógica de aplicación, acceso a persistencia, contratos y componentes
de soporte, salvo que una responsabilidad se comparta genuinamente en toda la aplicación.

### Límites explícitos

Las dependencias entre módulos deben ser visibles mediante las importaciones de módulos y los proveedores exportados.

Los proveedores internos deben permanecer privados, salvo que otro módulo tenga una razón concreta para consumirlos.

### Responsabilidad única

Los controladores, servicios, repositorios y otros proveedores deben tener responsabilidades cohesivas.

Los componentes deben dividirse cuando comiencen a asumir comportamientos no relacionados, en lugar de crecer hasta
convertirse en clases de propósito general.

### Aislamiento de persistencia

Los servicios de aplicación no deben depender directamente de API específicas de ORM.

El comportamiento de persistencia se aísla detrás de repositorios, de modo que los detalles de implementación de la base
de datos permanezcan fuera de la lógica de aplicación.

### Separación de infraestructura

La infraestructura transversal, como la conectividad de la base de datos y la configuración de la aplicación, se
mantiene separada de los módulos de funcionalidades de la aplicación.

La infraestructura da soporte a las funcionalidades, pero no define sus responsabilidades de aplicación.

### Complejidad incremental

La estructura arquitectónica debe crecer según los requisitos reales de la aplicación.

Las funcionalidades pequeñas pueden mantenerse simples. Las funcionalidades más grandes pueden introducir controladores,
servicios, repositorios u organización interna adicionales sin cambiar el modelo arquitectónico general.

### Independencia tecnológica

La arquitectura estructural no debe depender innecesariamente de una base de datos, ORM, estrategia de autenticación o
proveedor externo específico.

Las decisiones específicas de tecnología deben respetar los límites arquitectónicos definidos por el proyecto.

## Dirección de las dependencias

El flujo de dependencias típico es:

```text
Transporte
   ↓
Aplicación
   ↓
Persistencia
   ↓
Infraestructura
```

Las dependencias deben preservar estos límites e impedir que los detalles de implementación de nivel inferior se filtren
hacia responsabilidades de aplicación de nivel superior.

Entre funcionalidades, las dependencias deben pasar por API de módulos expuestas explícitamente.

## Alcance arquitectónico

Esta arquitectura define las convenciones predeterminadas para las aplicaciones creadas a partir del boilerplate.

No aplica por completo Clean Architecture, Hexagonal Architecture, Domain-Driven Design ni otra arquitectura formal.

Se pueden adoptar patrones de esos enfoques cuando mejoren los límites, la mantenibilidad o la capacidad de prueba. La
complejidad arquitectónica adicional debe justificarse mediante los requisitos de la aplicación.
