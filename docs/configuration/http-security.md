# Configuración de seguridad HTTP

La API aplica Helmet, una lista de permitidos CORS explícita y limitación global de tasa en memoria desde el espacio de
nombres de configuración `http`. Establezca las variables de entorno a continuación y luego reinicie el proceso para que
los cambios surtan efecto.

## Ruta rápida

1. Establezca `CORS_ORIGINS` con los orígenes de navegador que pueden llamar a la API.
2. Establezca `TRUST_PROXY_HOPS` únicamente cuando se conozca la topología del proxy de despliegue.
3. Ajuste la ventana y el límite de throttling para el despliegue, y luego reinicie la API.

## Variables de entorno

| Variable               | Predeterminado                              | Reglas                                                                      |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`             | `development`                               | Nombre de entorno no vacío.                                                 |
| `PORT`                 | `3000`                                      | Entero de 1 a 65535.                                                        |
| `CORS_ORIGINS`         | `http://localhost:3000` fuera de producción | Orígenes HTTP(S) separados por comas. Obligatorio y no vacío en producción. |
| `THROTTLE_TTL_SECONDS` | `60`                                        | Ventana de solicitudes en segundos con entero positivo.                     |
| `THROTTLE_LIMIT`       | `100`                                       | Solicitudes permitidas por ventana con entero positivo.                     |
| `TRUST_PROXY_HOPS`     | `0`                                         | Entero de 0 a 255.                                                          |

Los orígenes se recortan y normalizan. Se rechazan las entradas vacías, los duplicados, los comodines, las credenciales
en URL, los protocolos no HTTP(S), las rutas distintas de `/`, las cadenas de consulta y los fragmentos. Las
credenciales CORS siempre están deshabilitadas.

## Ejemplos

Desarrollo con un cliente de navegador local:

```sh
CORS_ORIGINS=http://localhost:3000 PORT=3001 pnpm start:dev
```

Producción con dos clientes de navegador y un proxy inverso:

```sh
NODE_ENV=production \
CORS_ORIGINS=https://app.example.com,https://admin.example.com \
TRUST_PROXY_HOPS=1 \
THROTTLE_TTL_SECONDS=60 \
THROTTLE_LIMIT=100 \
pnpm start:prod
```

## Notas de despliegue

### CORS de producción es explícito

El inicio en producción falla a menos que se proporcione explícitamente `CORS_ORIGINS` con al menos un origen válido.
CORS no es autenticación ni autorización: únicamente indica a los navegadores compatibles qué solicitudes entre orígenes
pueden exponer. Proteja las API con controles adecuados de autenticación y autorización.

### Confiar en el proxy requiere conocer la topología

Establezca `TRUST_PROXY_HOPS` únicamente en el número de saltos de proxy de confianza directamente delante de la API. Un
valor demasiado permisivo puede permitir que los clientes influyan en la dirección aparente del cliente, lo que afecta
el seguimiento de límites de tasa.

### El throttling es local a un proceso

El throttler de Nest configurado utiliza almacenamiento en memoria. Cada réplica tiene sus propios contadores, por lo
que un cliente puede recibir hasta el límite en cada réplica. Utilice almacenamiento compartido para el throttler o un
limitador de tasa en el borde cuando los límites deban aplicarse entre múltiples réplicas.

Todos los valores se leen y validan durante el inicio de la aplicación. Reinicie la API después de cambiarlos; los
cambios de entorno en tiempo de ejecución no reconfiguran un proceso en ejecución.
