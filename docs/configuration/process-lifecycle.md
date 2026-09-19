# Configuración de lifecycle de proceso

Status: Implemented

Este documento es el owner operativo del apagado del proceso. La arquitectura y los límites de responsabilidad se
definen en [configuration](../architecture/configuration.md); los eventos se definen en
[observability](../architecture/observability.md).

## Ruta rápida

1. Configure `SHUTDOWN_TIMEOUT_MS` cuando el deployment necesite un plazo distinto.
2. Reinicie el proceso para aplicar el valor validado durante startup.
3. Mantenga el plazo alineado con el tiempo de terminación concedido por el orquestador.

## Configuración

| Namespace  | Variable              | Predeterminado | Reglas                           |
| ---------- | --------------------- | -------------: | -------------------------------- |
| `shutdown` | `SHUTDOWN_TIMEOUT_MS` |       `10_000` | Entero positivo en milisegundos. |

Un valor ausente usa el predeterminado. Los valores vacíos, no numéricos, fraccionarios o no positivos fallan durante
startup. El valor es de solo lectura durante la ejecución; los cambios de environment requieren reiniciar el proceso.

## Comportamiento operativo

Después de un `listen()` exitoso, solo `SIGTERM` y `SIGINT` inician el apagado. La primera señal gana: el proceso llama
una vez a `app.close(signal)`, deja de aceptar conexiones y libera los recursos administrados por Nest. Un cierre
correcto elimina los listeners y reemite la misma señal.

El plazo cubre todo el cierre coordinado. Si vence o `app.close()` falla, el proceso escribe un único evento crítico
síncrono y termina con código `1`. Las señales repetidas y las completaciones tardías no cambian ese resultado terminal.

Readiness draining permanece diferido: `/health/ready` no publica un estado de draining ni cambia a `503` durante este
cierre.

## Evidencia

El target POSIX compilado verifica `SIGTERM`, `SIGINT`, cierre del listener y cierre correcto con una solicitud JSON
incompleta real. Los unit tests deterministas del coordinador verifican watchdog, completación tardía y fallo de cierre.
Esta división se seleccionó tras observar el comportamiento de Node 26: el proceso de aplicación no observó una salida
por timeout cuando se cerró la conexión HTTP incompleta real.

No se afirma evidencia de una salida por timeout a nivel de proceso. Consulte [testing](../testing/testing.md) para el
límite de prueba y su ejecución.
