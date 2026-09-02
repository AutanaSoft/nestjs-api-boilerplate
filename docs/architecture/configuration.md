# Configuración

Este documento define las convenciones de configuración de la aplicación.

El proyecto utiliza `@nestjs/config` para configuration registration y dependency injection, con Zod para runtime
validation.

## Límites de configuración

Las external configuration sources deben mantenerse aisladas de los consumidores de la aplicación.

Los ejemplos incluyen:

- environment variables;
- secret managers;
- mounted configuration files;
- external configuration services.

Los Application Services y los componentes de Features no deben acceder directamente a `process.env` ni a external secret
providers.

Los external values primero deben pasar por un configuration boundary y exponerse como configuración validada y tipada.

```text
External source
      ↓
Configuration factory
      ↓
Validation
      ↓
Typed configuration
      ↓
Application consumer
```

## Namespaced Configuration

La configuración debe agruparse en namespaces cohesivos.

Los ejemplos incluyen:

```text
http
database
auth
```

Cada namespace es responsable de:

- sus external inputs;
- defaults;
- normalization;
- derived values;
- validation;
- final configuration type.

Los namespaces deben usar nombres semánticos cortos y estables.

## Configuration Ownership

La configuración debe ubicarse en el límite arquitectónico que la posee.

La configuración global de la aplicación puede ubicarse en:

```text
src/config/
```

La configuración específica de un Feature puede ubicarse dentro de su Feature propietario.

Por ejemplo:

```text
src/modules/auth/
└── config/
    └── auth.config.ts
```

La configuración específica de infraestructura puede ubicarse junto a su infrastructure module.

```text
src/database/
└── config/
    └── database.config.ts
```

No mueva la configuración a un directorio global cuando exista un propietario más claro.

## Configuration Factories

Cada namespace debe exponer una named factory responsable de construir el objeto de configuración final completo.

La factory debe aplicar:

1. defaults;
2. explicit external overrides;
3. normalization y derived values;
4. final validation.

El objeto final debe ser válido antes de estar disponible para los consumidores de la aplicación.

```typescript
export const authConfigFactory = (): AuthConfig => {
  const candidate = {
    // defaults, external values and derived values
  };

  return authConfigSchema.parse(candidate);
};
```

El namespace se registra luego mediante `registerAs`.

```typescript
const authConfig = registerAs<AuthConfig>('auth', authConfigFactory);

export default authConfig;
```

Evite anonymous factories que devuelvan configuración no validada o parcial.

## Validación

La configuración debe fallar durante application startup cuando falten required values o sean inválidos.

No difiera configuration errors hasta que un Request alcance el Feature afectado.

Los Zod schemas deben validar el final configuration contract después de que se hayan aplicado defaults, normalization y
transformations.

Los configuration consumers no deben repetir la validación que ya pertenece al configuration namespace.

## External Values

Los external configuration values deben tratarse como untrusted input.

Los environment values pueden requerir:

- trimming;
- numeric coercion;
- URL validation;
- boolean normalization;
- list parsing;
- range validation.

Los defaults deben seleccionarse mediante comprobaciones explícitas de ausencia, en lugar de truthiness checks, cuando un
valor vacío deba considerarse inválido.

Por ejemplo, prefiera:

```typescript
const value = process.env.VALUE === undefined ? DEFAULT_VALUE : process.env.VALUE;
```

en lugar de:

```typescript
const value = process.env.VALUE || DEFAULT_VALUE;
```

## Typed Configuration

Los consumidores de un configuration namespace conocido deben inyectar directamente su NestJS configuration token.

```typescript
@Injectable()
export class ExampleService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}
}
```

Evite string-based lookups para namespaces conocidos:

```typescript
configService.get('auth.secret');
```

La inyección de typed namespaces hace explícitas las configuration dependencies y preserva el contrato validado.

`ConfigService` debe reservarse para casos que requieran genuinamente dynamic access o agregación entre múltiples
namespaces.

## Inmutabilidad

La startup configuration representa el estado inicial de la aplicación y debe tratarse como read-only.

Los configuration types deben usar read-only contracts cuando sea práctico.

Los mutable runtime settings pertenecen a un límite de aplicación separado y no deben modelarse como startup
configuration.

## Secrets

Los secrets no deben hardcodearse en el source code.

Deben ingresar a la aplicación mediante una external configuration source y pasar por el configuration boundary
adecuado.

Los secrets no deben exponerse mediante:

- logs;
- exception messages;
- diagnostic responses;
- configuration files versionados en el repositorio.

Los example environment files pueden documentar las variables requeridas, pero deben contener únicamente placeholder
values seguros.

## Reglas

1. Utilice `@nestjs/config` para configuration registration y dependency injection.
2. Valide la configuración en runtime con Zod antes de exponerla a los consumidores.
3. Organice la configuración en semantic namespaces cohesivos.
4. Mantenga la configuración junto al límite arquitectónico que la posee.
5. Aísle `process.env` y otras external configuration sources detrás de configuration boundaries.
6. Construya el namespace completo antes de realizar final validation.
7. Haga fallar application startup cuando la configuración requerida sea inválida.
8. Inyecte los namespaces conocidos mediante sus typed configuration tokens.
9. No disperse string-based configuration paths por todo el código de la aplicación.
10. Trate startup configuration como read-only.
11. Mantenga los secrets fuera del source code y de los diagnostics.
