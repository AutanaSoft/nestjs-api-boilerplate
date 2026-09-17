# Configuración de seguridad HTTP

Status: Implemented

La API aplica Helmet, una política CORS explícita y global Rate Limiting en memoria. Los namespaces
`api`, `http`, `cors`, `rateLimit` y `openapi` son propietarios de esta configuración. Establezca
las environment variables indicadas a continuación y reinicie el proceso para que los cambios surtan
efecto. La configuración de apagado del proceso, incluido `SHUTDOWN_TIMEOUT_MS`, pertenece a
[process lifecycle](process-lifecycle.md).

## Ruta rápida

1. Establezca `API_GLOBAL_PREFIX` si el deployment no debe usar el prefijo predeterminado `api`.
2. Establezca `CORS_ORIGINS` con los browser origins que pueden llamar a la API.
3. Establezca `TRUST_PROXY_HOPS` únicamente cuando se conozca la deployment proxy topology.
4. Ajuste la throttling window y el limit para el deployment, y luego reinicie la API.
5. Habilite `OPENAPI_ENABLED=true` solo cuando deba publicar la UI y el documento OpenAPI.

## Namespaces y variables

| Namespace   | Variable                 | Predeterminado                              | Reglas                                                                      |
| ----------- | ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| `api`       | `API_GLOBAL_PREFIX`      | `api`                                       | Path relativo normalizado; vacío explícito omite el prefijo.                |
| `http`      | `PORT`                   | `3000`                                      | Entero de 1 a 65535.                                                        |
| `http`      | `TRUST_PROXY_HOPS`       | `0`                                         | Entero de 0 a 255.                                                          |
| `cors`      | `CORS_ORIGINS`           | `http://localhost:3000` fuera de producción | Orígenes HTTP(S) separados por comas. Obligatorio y no vacío en producción. |
| `cors`      | `CORS_MAX_AGE_SECONDS`   | `600`                                       | Entero de 0 a 86400. `0` desactiva el caché de preflight.                   |
| `rateLimit` | `THROTTLE_TTL_SECONDS`   | `60`                                        | Request window en segundos con entero positivo.                             |
| `rateLimit` | `THROTTLE_LIMIT`         | `100`                                       | Requests permitidos por window con entero positivo.                         |
| `openapi`   | `OPENAPI_ENABLED`        | `false`                                     | Solo acepta `true` o `false`; controla la exposición condicional.           |
| `openapi`   | `OPENAPI_DOCS_ROUTE`     | `docs`                                      | Path relativo normalizado para la UI.                                       |
| `openapi`   | `OPENAPI_DOCUMENT_ROUTE` | `openapi.json`                              | Path relativo normalizado para el documento JSON; debe diferir de la UI.    |

`API_GLOBAL_PREFIX` acepta paths relativos normalizados como `api` o `platform/api`. Rechaza slash
inicial o final, segmentos vacíos, `.`, `..`, espacios, query strings y fragments. Un valor vacío
explícito publica las rutas bajo `/v1`; el valor no configura dominios, hosts ni autorización.

Las rutas OpenAPI no pueden estar vacías ni comenzar o terminar con `/`; rechazan segmentos vacíos,
`.`, `..`, espacios, query strings y fragments. Ambas rutas deben diferir. Cuando OpenAPI está
habilitado, las rutas predeterminadas son `/docs` y `/openapi.json`; permanecen fuera de
`API_GLOBAL_PREFIX` y del URI versioning. El startup rechaza rutas OpenAPI que se solapen
estructuralmente con una ruta API publicada.

Los origins se recortan y normalizan. Se rechazan las entradas vacías, duplicados, wildcards,
credentials en URLs, protocolos no HTTP(S), paths distintos de `/`, query strings y fragments.

La política CORS fija los métodos `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` y
`QUERY`; permite los headers `Accept`, `Authorization`, `Content-Type` y `X-Request-Id`; expone solo
`X-Request-Id`; mantiene credentials deshabilitadas; responde preflight con `204`; y no continúa el
preflight hacia la aplicación.

## Ejemplos

Desarrollo con un browser client local:

```sh
CORS_ORIGINS=http://localhost:3000 PORT=3001 pnpm start:dev
```

Producción con dos browser clients y un reverse proxy:

```sh
NODE_ENV=production \
CORS_ORIGINS=https://app.example.com,https://admin.example.com \
CORS_MAX_AGE_SECONDS=600 \
TRUST_PROXY_HOPS=1 \
THROTTLE_TTL_SECONDS=60 \
THROTTLE_LIMIT=100 \
pnpm start:prod
```

## Notas de deployment

### Helmet y Swagger UI

La UI de Swagger se instala después del bootstrap HTTP común y conserva Helmet, correlación y
logging. La evidencia E2E observó en `/docs` el CSP predeterminado de Helmet: `default-src 'self'`,
`script-src 'self'`, `style-src 'self' https: 'unsafe-inline'` e `img-src 'self' data:`. No existe
una excepción de CSP específica para OpenAPI; el documento JSON conserva la política global.

### CORS de producción es explícito

El startup en producción falla a menos que se proporcione explícitamente `CORS_ORIGINS` con al menos
un origin válido. CORS no es authentication ni authorization: únicamente indica a los browsers
compatibles qué cross-origin Requests pueden exponer. Proteja las APIs con controles adecuados de
authentication y authorization.

### Confiar en el proxy requiere conocer la topology

Establezca `TRUST_PROXY_HOPS` únicamente en el número de trusted proxy hops directamente delante de
la API. Un valor demasiado permisivo puede permitir que los clients influyan en la client address
aparente, lo que afecta el seguimiento de Rate Limits.

### El Throttling es local a un proceso

El NestJS Throttler configurado utiliza in-memory storage. Cada replica tiene sus propios counters,
por lo que un client puede recibir hasta el limit en cada replica. Utilice shared storage para el
Throttler o un edge Rate Limiter cuando los límites deban aplicarse entre múltiples replicas.

Todos los valores se leen y validan durante application startup. Reinicie la API después de
cambiarlos; los runtime environment changes no reconfiguran un proceso en ejecución.
