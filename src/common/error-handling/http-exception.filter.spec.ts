import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_ID_HEADER, UNMATCHED_ROUTE } from '../observability/constants.js';
import { RequestContextService } from '../observability/context/request-context.service.js';
import type { ApplicationLogger } from '../observability/logging/application-logger.js';
import { ApplicationError } from './application-error.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { ResponseContractViolation } from '../serialization/response-contract-violation.js';

type FilterRequest = Readonly<{
  method: string;
  route?: unknown;
  originalUrl?: string;
}>;

type FilterResponse = {
  setHeader(name: typeof REQUEST_ID_HEADER, value: string): void;
  status(statusCode: number): FilterResponse;
  json(body: unknown): void;
};

type ResourceNotFoundContext = Readonly<{
  resourceId: string;
}>;

class ResourceNotFoundError extends ApplicationError {
  readonly code = 'RESOURCE_NOT_FOUND' as const;

  constructor(readonly context: ResourceNotFoundContext) {
    super();
  }
}

describe('HttpExceptionFilter', () => {
  it('rebuilds an allowlisted HttpException response using the context request ID', () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    const context = new RequestContextService();
    const logger = createLogger();
    const response = createResponse();
    const filter = new HttpExceptionFilter(context, logger);

    context.run(requestId, () => {
      filter.catch(
        new HttpException({ token: 'secret-token' }, HttpStatus.BAD_REQUEST),
        createHost({ method: 'POST', route: { path: '/widgets' } }, response),
      );
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message: 'The request is invalid.',
      requestId,
    });
    expect(logger.logUnexpectedHttpError).not.toHaveBeenCalled();
  });

  it('uses one UUIDv4 fallback in the header, body, and internal log metadata', () => {
    const context = new RequestContextService();
    const logger = createLogger();
    const response = createResponse();
    const filter = new HttpExceptionFilter(context, logger);

    filter.catch(
      new Error('database password leaked'),
      createHost({ method: 'GET', route: { path: '/widgets' } }, response),
    );

    const requestId = getRequestId(response);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
    expect(logger.logUnexpectedHttpError).toHaveBeenCalledExactlyOnceWith({
      requestId,
      requestIdFallback: true,
      method: 'GET',
      route: '/widgets',
      errorType: 'UNKNOWN_ERROR',
    });
  });

  it('maps and logs ResponseContractViolation once with a stable safe classification', () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    const context = new RequestContextService();
    const logger = createLogger();
    const response = createResponse();
    const filter = new HttpExceptionFilter(context, logger);
    const exception = Object.assign(
      new ResponseContractViolation({
        cause: new Error('native serialization message'),
      }),
      {
        issues: ['private validation issues'],
        value: { token: 'private-value' },
        rejectedValue: { token: 'secret-token' },
        schema: 'private schema',
        technologyName: 'Zod',
      },
    );

    context.run(requestId, () => {
      filter.catch(exception, createHost({ method: 'GET', route: { path: '/widgets' } }, response));
    });

    expect(response.setHeader).toHaveBeenCalledExactlyOnceWith(REQUEST_ID_HEADER, requestId);
    expect(response.status).toHaveBeenCalledExactlyOnceWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledExactlyOnceWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
    expect(logger.logUnexpectedHttpError).toHaveBeenCalledExactlyOnceWith({
      requestId,
      requestIdFallback: false,
      method: 'GET',
      route: '/widgets',
      errorType: 'RESPONSE_CONTRACT_VIOLATION',
    });

    const output = JSON.stringify({
      body: response.json.mock.calls[0]?.[0],
      metadata: logger.logUnexpectedHttpError.mock.calls[0]?.[0],
    });
    expect(output).not.toContain('native serialization message');
    expect(output).not.toContain('private validation issues');
    expect(output).not.toContain('private-value');
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('private schema');
    expect(output).not.toContain('Zod');
    expect(output).not.toContain('ResponseContractViolation');
    expect(output).not.toContain('stack');
    expect(output).not.toContain('cause');
    expect(output).not.toContain('schema');
    expect(output).not.toContain('issues');
  });

  it('does not log expected application errors', () => {
    const context = new RequestContextService();
    const logger = createLogger();
    const response = createResponse();
    const filter = new HttpExceptionFilter(context, logger);

    filter.catch(
      new ResourceNotFoundError({ resourceId: 'private-resource-id' }),
      createHost({ method: 'GET', route: { path: '/widgets/:id' } }, response),
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(logger.logUnexpectedHttpError).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, UNMATCHED_ROUTE],
    [{ path: 123 }, UNMATCHED_ROUTE],
    [{ path: '/private?accessToken=secret' }, '/private'],
    [{ path: '/private#details' }, '/private'],
    [{ path: '' }, UNMATCHED_ROUTE],
    [{ path: '/widgets/:id' }, '/widgets/:id'],
  ])(
    'uses the normalized route or unmatched fallback for unexpected errors: %o',
    (route, expectedRoute) => {
      const context = new RequestContextService();
      const logger = createLogger();
      const response = createResponse();
      const filter = new HttpExceptionFilter(context, logger);

      filter.catch(
        { body: { token: 'secret-token' }, message: 'database password leaked' },
        createHost(
          { method: 'DELETE', route, originalUrl: '/private?accessToken=secret' },
          response,
        ),
      );

      expect(logger.logUnexpectedHttpError).toHaveBeenCalledExactlyOnceWith({
        requestId: getRequestId(response),
        requestIdFallback: true,
        method: 'DELETE',
        route: expectedRoute,
        errorType: 'UNKNOWN_ERROR',
      });
    },
  );

  it('does not leak request or error diagnostics through the response or unexpected-error log', () => {
    const context = new RequestContextService();
    const logger = createLogger();
    const response = createResponse();
    const filter = new HttpExceptionFilter(context, logger);
    const error = new Error('database password leaked', {
      cause: new Error('provider token secret-token'),
    });

    filter.catch(
      error,
      createHost(
        {
          method: 'PATCH',
          route: { path: '/widgets/:id' },
          originalUrl: '/widgets/123?accessToken=secret',
        },
        response,
      ),
    );

    const responseBody = response.json.mock.calls[0]?.[0];
    const loggedMetadata = logger.logUnexpectedHttpError.mock.calls[0]?.[0];
    const serializedOutput = JSON.stringify({ responseBody, loggedMetadata });

    expect(serializedOutput).not.toContain('database password leaked');
    expect(serializedOutput).not.toContain('provider token secret-token');
    expect(serializedOutput).not.toContain('accessToken=secret');
    expect(serializedOutput).not.toContain('/widgets/123');
    expect(loggedMetadata).toEqual({
      requestId: getRequestId(response),
      requestIdFallback: true,
      method: 'PATCH',
      route: '/widgets/:id',
      errorType: 'UNKNOWN_ERROR',
    });
  });
});

function createLogger(): ApplicationLogger & {
  logUnexpectedHttpError: ReturnType<typeof vi.fn<ApplicationLogger['logUnexpectedHttpError']>>;
} {
  return {
    logHttpRequestCompleted: vi.fn<ApplicationLogger['logHttpRequestCompleted']>(),
    logUnexpectedHttpError: vi.fn<ApplicationLogger['logUnexpectedHttpError']>(),
  };
}

function createResponse(): FilterResponse & {
  setHeader: ReturnType<typeof vi.fn<FilterResponse['setHeader']>>;
  status: ReturnType<typeof vi.fn<FilterResponse['status']>>;
  json: ReturnType<typeof vi.fn<FilterResponse['json']>>;
} {
  const response = {
    setHeader: vi.fn<FilterResponse['setHeader']>(),
    status: vi.fn<FilterResponse['status']>(),
    json: vi.fn<FilterResponse['json']>(),
  };
  response.status.mockReturnValue(response);

  return response;
}

function createHost(request: FilterRequest, response: FilterResponse): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

function getRequestId(response: ReturnType<typeof createResponse>): string {
  const body = response.json.mock.calls[0]?.[0];

  if (!isRecord(body) || typeof body.requestId !== 'string') {
    throw new Error('Expected an error response with a request ID.');
  }

  return body.requestId;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}
