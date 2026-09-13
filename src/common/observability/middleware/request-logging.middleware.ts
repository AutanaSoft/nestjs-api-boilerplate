import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction } from 'express';
import { APP_LOGGER, REQUEST_DURATION_CLOCK, UNMATCHED_ROUTE } from '../constants.js';
import { RequestContextService } from '../context/request-context.service.js';
import type { ApplicationLogger } from '../logging/application-logger.js';

type RequestLoggingRequest = {
  method: string;
  route?: { path?: string };
};

type RequestLoggingResponse = {
  statusCode: number;
  once(event: 'finish', callback: () => void): void;
};

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware<
  RequestLoggingRequest,
  RequestLoggingResponse
> {
  constructor(
    private readonly requestContext: RequestContextService,
    @Inject(APP_LOGGER) private readonly logger: ApplicationLogger,
    @Inject(REQUEST_DURATION_CLOCK) private readonly now: () => number,
  ) {}

  use(request: RequestLoggingRequest, response: RequestLoggingResponse, next: NextFunction): void {
    const startedAt = this.now();

    response.once(
      'finish',
      this.requestContext.bind(() => {
        this.logger.logHttpRequestCompleted({
          method: request.method,
          route: getRoute(request.route),
          statusCode: response.statusCode,
          durationMs: Math.max(0, this.now() - startedAt),
        });
      }),
    );
    next();
  }
}

function getRoute(route: RequestLoggingRequest['route']): string {
  if (route?.path === undefined || route.path.endsWith('/{*path}')) {
    return UNMATCHED_ROUTE;
  }

  return route.path;
}
