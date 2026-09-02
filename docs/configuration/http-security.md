# Configuración de seguridad HTTP

Status: Implemented

La API aplica Helmet, una lista explícita de orígenes CORS permitidos y global Rate Limiting en memoria desde el
configuration namespace `http`. Establezca las environment variables indicadas a continuación y luego reinicie el
proceso para que los cambios surtan efecto.

## Ruta rápida

1. Establezca `CORS_ORIGINS` con los browser origins que pueden llamar a la API.
2. Establezca `TRUST_PROXY_HOPS` únicamente cuando se conozca la deployment proxy topology.
3. Ajuste la throttling window y el limit para el deployment, y luego reinicie la API.

## Environment Variables

| Variable               | Predeterminado                              | Reglas                                                                      |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`             | `development`                               | Nombre de entorno no vacío.                                                 |
| `PORT`                 | `3000`                                      | Entero de 1 a 65535.                                                        |
| `CORS_ORIGINS`         | `http://localhost:3000` fuera de producción | Orígenes HTTP(S) separados por comas. Obligatorio y no vacío en producción. |
| `THROTTLE_TTL_SECONDS` | `60`                                        | Request window en segundos con entero positivo.                             |
| `THROTTLE_LIMIT`       | `100`                                       | Requests permitidos por window con entero positivo.                         |
| `TRUST_PROXY_HOPS`     | `0`                                         | Entero de 0 a 255.                                                          |

Los origins se recortan y normalizan. Se rechazan las entradas vacías, duplicados, wildcards, credentials en URLs,
protocolos no HTTP(S), paths distintos de `/`, query strings y fragments. Las CORS credentials siempre están
deshabilitadas.

## Ejemplos

Desarrollo con un browser client local:

```sh
CORS_ORIGINS=http://localhost:3000 PORT=3001 pnpm start:dev
```

Producción con dos browser clients y un reverse proxy:

```sh
NODE_ENV=production \
CORS_ORIGINS=https://app.example.com,https://admin.example.com \
TRUST_PROXY_HOPS=1 \
THROTTLE_TTL_SECONDS=60 \
THROTTLE_LIMIT=100 \
pnpm start:prod
```

## Notas de deployment

### CORS de producción es explícito

El startup en producción falla a menos que se proporcione explícitamente `CORS_ORIGINS` con al menos un origin válido.
CORS no es authentication ni authorization: únicamente indica a los browsers compatibles qué cross-origin Requests
pueden exponer. Proteja las APIs con controles adecuados de authentication y authorization.

### Confiar en el proxy requiere conocer la topology

Establezca `TRUST_PROXY_HOPS` únicamente en el número de trusted proxy hops directamente delante de la API. Un valor
demasiado permisivo puede permitir que los clients influyan en la client address aparente, lo que afecta el seguimiento
de Rate Limits.

### El Throttling es local a un proceso

El NestJS Throttler configurado utiliza in-memory storage. Cada replica tiene sus propios counters, por lo que un client
puede recibir hasta el limit en cada replica. Utilice shared storage para el Throttler o un edge Rate Limiter cuando los
límites deban aplicarse entre múltiples replicas.

Todos los valores se leen y validan durante application startup. Reinicie la API después de cambiarlos; los runtime
environment changes no reconfiguran un proceso en ejecución.
