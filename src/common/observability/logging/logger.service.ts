import { ConsoleLogger, Injectable, Optional, type LoggerService } from '@nestjs/common';
import type {
  ApplicationLogger,
  HttpRequestCompletedMetadata,
  UnexpectedHttpErrorMetadata,
} from './application-logger.js';
import { HTTP_REQUEST_COMPLETED_EVENT, HTTP_REQUEST_FAILED_EVENT } from '../constants.js';
import { RequestContextService } from '../context/request-context.service.js';

@Injectable()
export class StructuredLoggerService implements ApplicationLogger, LoggerService {
  constructor(
    private readonly requestContext: RequestContextService,
    @Optional()
    private readonly consoleLogger: Pick<
      ConsoleLogger,
      'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal'
    > = new ConsoleLogger({ json: true, colors: true, flattenParams: true }),
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
