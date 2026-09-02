# Configuración

Este documento define las convenciones de configuración de la aplicación para el Boilerplate de API de NestJS.

El proyecto utiliza `@nestjs/config` para el registro de configuración y la inyección de dependencias, con Zod para la
validación en tiempo de ejecución.

## Límites de configuración

Las fuentes de configuración externas deben mantenerse aisladas de los consumidores de la aplicación.

Los ejemplos incluyen:

- variables de entorno;
- gestores de secretos;
- archivos de configuración montados;
- servicios de configuración externos.

Los servicios de aplicación y los componentes de funcionalidades no deben acceder directamente a `process.env` ni a
proveedores externos de secretos.

Los valores externos primero deben pasar por un límite de configuración y exponerse como configuración validada y
tipada.

```text
Fuente externa
      ↓
Fábrica de configuración
      ↓
Validación
      ↓
Configuración tipada
      ↓
Consumidor de la aplicación
```

## Configuración con espacios de nombres

La configuración debe agruparse en espacios de nombres cohesivos.

Los ejemplos incluyen:

```text
http
database
auth
```

Cada espacio de nombres es propietario de:

- sus entradas externas;
- valores predeterminados;
- normalización;
- valores derivados;
- validación;
- tipo de configuración final.

Los espacios de nombres deben usar nombres semánticos cortos y estables.

## Propiedad de la configuración

La configuración debe ubicarse en el límite arquitectónico que la posee.

La configuración de toda la aplicación puede ubicarse en:

```text
src/config/
```

La configuración específica de una funcionalidad puede ubicarse dentro de la funcionalidad propietaria.

Por ejemplo:

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

La configuración específica de infraestructura puede ubicarse con su módulo de infraestructura.

```text
src/database/
└── config/
    └── database.config.ts
```

No mueva la configuración a un directorio global cuando exista un propietario más claro.

## Fábricas de configuración

Cada espacio de nombres debe exponer una fábrica con nombre responsable de construir el objeto de configuración final
completo.

La fábrica debe aplicar:

1. valores predeterminados;
2. anulaciones externas explícitas;
3. normalización y valores derivados;
4. validación final.

El objeto final debe ser válido antes de estar disponible para los consumidores de la aplicación.

```typescript
export const authConfigFactory = (): AuthConfig => {
  const candidate = {
    // defaults, external values and derived values
  };

  return authConfigSchema.parse(candidate);
};
```

El espacio de nombres se registra luego mediante `registerAs`.

```typescript
const authConfig = registerAs<AuthConfig>('auth', authConfigFactory);

export default authConfig;
```

Evite las fábricas anónimas que devuelven configuración no validada o parcial.

## Validación

La configuración debe fallar durante el inicio de la aplicación cuando falten valores requeridos o sean inválidos.

No difiera los errores de configuración hasta que una solicitud alcance la funcionalidad afectada.

Los esquemas de Zod deben validar el contrato de configuración final después de que se hayan aplicado los valores
predeterminados, la normalización y las transformaciones.

Los consumidores de configuración no deben repetir la validación que ya es propiedad del espacio de nombres de
configuración.

## Valores externos

Los valores de configuración externos deben tratarse como entrada no confiable.

Los valores de entorno pueden requerir:

- recorte de espacios;
- coerción numérica;
- validación de URL;
- normalización de booleanos;
- análisis de listas;
- validación de rangos.

Los valores predeterminados deben seleccionarse mediante comprobaciones explícitas de ausencia, en lugar de valores de
veracidad, cuando un valor vacío deba considerarse inválido.

Por ejemplo, prefiera:

```typescript
const value = process.env.VALUE === undefined ? DEFAULT_VALUE : process.env.VALUE;
```

en lugar de:

```typescript
const value = process.env.VALUE || DEFAULT_VALUE;
```

## Configuración tipada

Los consumidores de un espacio de nombres de configuración conocido deben inyectar directamente su token de
configuración de NestJS.

```typescript
@Injectable()
export class ExampleService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}
}
```

Evite las búsquedas basadas en cadenas para espacios de nombres conocidos:

```typescript
configService.get('auth.secret');
```

La inyección de espacios de nombres tipados hace explícitas las dependencias de configuración y preserva el contrato
validado.

`ConfigService` debe reservarse para casos que requieran genuinamente acceso dinámico o agregación entre múltiples
espacios de nombres.

## Inmutabilidad

La configuración de arranque representa el estado de inicio de la aplicación y debe tratarse como de solo lectura.

Los tipos de configuración deben usar contratos de solo lectura cuando sea práctico.

Los ajustes mutables en tiempo de ejecución pertenecen a un límite de aplicación separado y no deben modelarse como
configuración de arranque.

## Secretos

Los secretos no deben codificarse de forma rígida en el código fuente.

Deben ingresar a la aplicación mediante una fuente de configuración externa y pasar por el límite de configuración
adecuado.

Los secretos no deben exponerse mediante:

- registros;
- mensajes de excepción;
- respuestas de diagnóstico;
- archivos de configuración confirmados en el repositorio.

Los archivos de entorno de ejemplo pueden documentar las variables requeridas, pero deben contener únicamente valores de
marcador de posición seguros.

## Reglas

1. Utilice `@nestjs/config` para el registro de configuración de la aplicación y la inyección de dependencias.
2. Valide la configuración en tiempo de ejecución con Zod antes de exponerla a los consumidores.
3. Organice la configuración en espacios de nombres semánticos cohesivos.
4. Mantenga la configuración con el límite arquitectónico que la posee.
5. Aísle `process.env` y otras fuentes de configuración externas detrás de límites de configuración.
6. Construya el espacio de nombres completo antes de realizar la validación final.
7. Haga fallar el inicio de la aplicación cuando la configuración requerida sea inválida.
8. Inyecte los espacios de nombres conocidos mediante sus tokens de configuración tipados.
9. No disperse rutas de configuración basadas en cadenas por todo el código de la aplicación.
10. Trate la configuración de arranque como de solo lectura.
11. Mantenga los secretos fuera del código fuente y los diagnósticos.
