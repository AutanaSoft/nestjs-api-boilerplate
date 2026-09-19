import {
  ConsoleLogger,
  Inject,
  Injectable,
  Optional,
  type ConsoleLoggerOptions,
  type LoggerService,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig, { appConfigFactory } from '../../../config/app.config.js';
import type {
  ApplicationLogger,
  HttpRequestCompletedMetadata,
  ShutdownCompletedMetadata,
  StartupCompletedMetadata,
  ShutdownStartedMetadata,
  UnexpectedHttpErrorMetadata,
} from './application-logger.js';
import {
  HTTP_REQUEST_COMPLETED_EVENT,
  HTTP_REQUEST_FAILED_EVENT,
  SHUTDOWN_COMPLETED_EVENT,
  STARTUP_COMPLETED_EVENT,
  SHUTDOWN_STARTED_EVENT,
} from '../constants.js';
import { RequestContextService } from '../context/request-context.service.js';

const DEVELOPMENT_LOG_LEVELS = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'] as const;
const PRODUCTION_LOG_LEVELS = ['log', 'warn', 'error', 'fatal'] as const;

export function buildConsoleLoggerOptions(nodeEnv: ConfigType<typeof appConfig>['nodeEnv']): ConsoleLoggerOptions {
  const isProduction = nodeEnv === 'production';

  return {
    logLevels: isProduction ? [...PRODUCTION_LOG_LEVELS] : [...DEVELOPMENT_LOG_LEVELS],
    json: true,
    colors: !isProduction,
    flattenParams: true,
  };
}

@Injectable()
export class StructuredLoggerService implements ApplicationLogger, LoggerService {
  constructor(
    private readonly requestContext: RequestContextService,
    @Optional()
    @Inject(appConfig.KEY)
    appMetadata: ConfigType<typeof appConfig> = appConfigFactory(),
    @Optional()
    private readonly consoleLogger: Pick<
      ConsoleLogger,
      'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal'
    > = new ConsoleLogger(buildConsoleLoggerOptions(appMetadata.nodeEnv)),
  ) {}

  logHttpRequestCompleted(metadata: HttpRequestCompletedMetadata): void {
    this.consoleLogger.log(HTTP_REQUEST_COMPLETED_EVENT, {
      requestId: this.requestContext.getRequestId(),
      method: metadata.method,
      route: metadata.route,
      statusCode: metadata.statusCode,
      durationMs: metadata.durationMs,
    });
  }

  logUnexpectedHttpError(metadata: UnexpectedHttpErrorMetadata): void {
    this.consoleLogger.error(HTTP_REQUEST_FAILED_EVENT, {
      requestId: metadata.requestId,
      requestIdFallback: metadata.requestIdFallback,
      method: metadata.method,
      route: metadata.route,
      errorType: metadata.errorType,
    });
  }

  logStartupCompleted(metadata: StartupCompletedMetadata): void {
    this.consoleLogger.log(STARTUP_COMPLETED_EVENT, {
      serverUrl: metadata.serverUrl,
      apiBasePath: metadata.apiBasePath,
      ...(metadata.openapiUrl === undefined ? {} : { openapiUrl: metadata.openapiUrl }),
    });
  }

  logShutdownStarted(metadata: ShutdownStartedMetadata): void {
    this.consoleLogger.log(SHUTDOWN_STARTED_EVENT, {
      signal: metadata.signal,
      timeoutMs: metadata.timeoutMs,
    });
  }

  logShutdownCompleted(metadata: ShutdownCompletedMetadata): void {
    this.consoleLogger.log(SHUTDOWN_COMPLETED_EVENT, {
      signal: metadata.signal,
      durationMs: metadata.durationMs,
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.log(message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.error(message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.warn(message, ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.debug(message, ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.verbose(message, ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.consoleLogger.fatal(message, ...optionalParams);
  }
}
