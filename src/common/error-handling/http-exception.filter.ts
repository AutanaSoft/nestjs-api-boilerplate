import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { APP_LOGGER, REQUEST_ID_HEADER, UNMATCHED_ROUTE } from '../observability/constants.js';
import { RequestContextService } from '../observability/context/request-context.service.js';
import type { ApplicationLogger } from '../observability/logging/application-logger.js';
import { mapErrorToResponse } from './http-error-mapping.js';

const UNKNOWN_ERROR = 'UNKNOWN_ERROR';

type HttpErrorRequest = Readonly<{
  method: string;
  route?: unknown;
}>;

type HttpErrorResponse = {
  setHeader(name: typeof REQUEST_ID_HEADER, value: string): void;
  status(statusCode: number): HttpErrorResponse;
  json(body: ReturnType<typeof mapErrorToResponse>): void;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly requestContext: RequestContextService,
    @Inject(APP_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpErrorRequest>();
    const response = http.getResponse<HttpErrorResponse>();
    const contextRequestId = this.requestContext.getRequestId();
    const requestId = contextRequestId ?? randomUUID();
    const errorResponse = mapErrorToResponse(exception, requestId);

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(errorResponse.statusCode).json(errorResponse);

    if (errorResponse.statusCode === 500) {
      this.logger.logUnexpectedHttpError({
        requestId,
        requestIdFallback: contextRequestId === undefined,
        method: request.method,
        route: getRoute(request.route),
        errorType: UNKNOWN_ERROR,
      });
    }
  }
}

function getRoute(route: unknown): string {
  if (!isRecord(route) || typeof route.path !== 'string') {
    return UNMATCHED_ROUTE;
  }

  const normalizedRoute = route.path.split(/[?#]/, 1)[0];

  return normalizedRoute === '' ? UNMATCHED_ROUTE : normalizedRoute;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}
