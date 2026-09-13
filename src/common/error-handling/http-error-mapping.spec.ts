import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ApplicationError } from './application-error.js';
import { applicationErrorHttpDescriptors, mapErrorToResponse } from './http-error-mapping.js';

type ResourceNotFoundContext = Readonly<{
  resourceId: string;
}>;

class ResourceNotFoundError extends ApplicationError {
  readonly code = 'RESOURCE_NOT_FOUND' as const;

  constructor(
    readonly context: ResourceNotFoundContext,
    options?: ErrorOptions,
  ) {
    super(options);
  }
}

type ConflictContext = Readonly<{
  conflictingField: string;
}>;

class ConflictError extends ApplicationError {
  readonly code = 'CONFLICT' as const;

  constructor(
    readonly context: ConflictContext,
    options?: ErrorOptions,
  ) {
    super(options);
  }
}

describe('applicationErrorHttpDescriptors', () => {
  it('contains immutable approved mappings for every ApplicationError code', () => {
    expect(applicationErrorHttpDescriptors.RESOURCE_NOT_FOUND).toEqual({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
    });
    expect(applicationErrorHttpDescriptors.CONFLICT).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'The request conflicts with the current resource state.',
    });
    expect(Object.isFrozen(applicationErrorHttpDescriptors)).toBe(true);
    expect(Object.isFrozen(applicationErrorHttpDescriptors.RESOURCE_NOT_FOUND)).toBe(true);
    expect(Object.isFrozen(applicationErrorHttpDescriptors.CONFLICT)).toBe(true);
  });
});

describe('mapErrorToResponse', () => {
  const requestId = 'f5eb2c44-618c-4ea4-90f5-4c32a6d306c4';

  it('maps local ApplicationError variants through the public catalogue', () => {
    expect(
      mapErrorToResponse(new ResourceNotFoundError({ resourceId: 'resource-123' }), requestId),
    ).toEqual({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId,
    });
    expect(mapErrorToResponse(new ConflictError({ conflictingField: 'email' }), requestId)).toEqual(
      {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'The request conflicts with the current resource state.',
        requestId,
      },
    );
  });

  it.each([new Error('database password leaked'), 'untrusted input', { stack: 'private stack' }])(
    'maps unknown value %# to the safe internal fallback',
    (error) => {
      const response = mapErrorToResponse(error, requestId);

      expect(response).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId,
      });
      expect(response).not.toHaveProperty('details');
      expect(response).not.toHaveProperty('stack');
      expect(response).not.toHaveProperty('cause');
    },
  );

  it('builds a new safe response without exposing ApplicationError internals', () => {
    const cause = new Error('database password leaked');
    const error = new ResourceNotFoundError({ resourceId: 'private-resource-id' }, { cause });
    error.message = 'technical message';

    const firstResponse = mapErrorToResponse(error, requestId);
    const secondResponse = mapErrorToResponse(error, requestId);

    expect(firstResponse).not.toBe(secondResponse);
    expect(firstResponse).toEqual({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId,
    });
    expect(JSON.stringify(firstResponse)).not.toContain('technical message');
    expect(JSON.stringify(firstResponse)).not.toContain('private-resource-id');
    expect(JSON.stringify(firstResponse)).not.toContain('database password leaked');
  });

  it('falls back safely when an ApplicationError has an unrecognized runtime code', () => {
    const error = new ResourceNotFoundError({ resourceId: 'resource-123' });
    Object.defineProperty(error, 'code', { value: 'UNRECOGNIZED_CODE' });

    expect(mapErrorToResponse(error, requestId)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });

  it('falls back safely when an ApplicationError runtime code resolves through the prototype', () => {
    const error = new ResourceNotFoundError({ resourceId: 'resource-123' });
    Object.defineProperty(error, 'code', { value: 'toString' });

    expect(mapErrorToResponse(error, requestId)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });
});

describe('mapErrorToResponse HttpException allowlist', () => {
  const requestId = 'f5eb2c44-618c-4ea4-90f5-4c32a6d306c4';

  it.each([
    [HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'The request is invalid.'],
    [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication is required.'],
    [HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You are not allowed to perform this action.'],
    [HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'The requested route was not found.'],
    [HttpStatus.CONFLICT, 'CONFLICT', 'The request conflicts with the current resource state.'],
    [HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many requests.'],
  ] as const)(
    'maps approved status %i to its safe public descriptor',
    (statusCode, code, message) => {
      const error = new HttpException('untrusted framework message', statusCode);

      expect(mapErrorToResponse(error, requestId)).toEqual({
        statusCode,
        code,
        message,
        requestId,
      });
    },
  );

  it('rebuilds a response independently from a string body', () => {
    const body = 'database password leaked';
    const error = new HttpException(body, HttpStatus.BAD_REQUEST);
    error.message = 'technical framework message';

    const response = mapErrorToResponse(error, requestId);

    expect(response).not.toBe(body);
    expect(response).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'The request is invalid.',
      requestId,
    });
    expect(JSON.stringify(response)).not.toContain(body);
    expect(JSON.stringify(response)).not.toContain(error.message);
  });

  it('rebuilds a response independently from an object body with sensitive payload', () => {
    const body = {
      cause: 'provider failure',
      message: 'database password leaked',
      stack: 'private stack',
      token: 'secret-token',
    };
    const error = new HttpException(body, HttpStatus.NOT_FOUND);

    const response = mapErrorToResponse(error, requestId);

    expect(response).not.toBe(body);
    expect(response).toEqual({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route was not found.',
      requestId,
    });
    expect(JSON.stringify(response)).not.toContain('provider failure');
    expect(JSON.stringify(response)).not.toContain('database password leaked');
    expect(JSON.stringify(response)).not.toContain('private stack');
    expect(JSON.stringify(response)).not.toContain('secret-token');
    expect(response).not.toHaveProperty('details');
  });

  it.each([HttpStatus.I_AM_A_TEAPOT, 0, Number.NaN])(
    'maps disallowed or invalid status %p to the safe internal fallback',
    (statusCode) => {
      const error = new HttpException({ token: 'secret-token' }, statusCode);

      expect(mapErrorToResponse(error, requestId)).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId,
      });
    },
  );

  it('falls back safely when a real HttpException subclass throws while reading its status', () => {
    class ThrowingStatusHttpException extends HttpException {
      override getStatus(): number {
        throw new Error('untrusted status read');
      }
    }

    expect(
      mapErrorToResponse(
        new ThrowingStatusHttpException('untrusted framework message', 400),
        requestId,
      ),
    ).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });

  it('falls back safely when a real HttpException subclass returns a prototype status at runtime', () => {
    class PrototypeStatusHttpException extends HttpException {
      override getStatus(): number {
        return 'toString' as unknown as number;
      }
    }

    expect(
      mapErrorToResponse(
        new PrototypeStatusHttpException('untrusted framework message', 400),
        requestId,
      ),
    ).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });

  it('falls back safely when a real HttpException subclass returns a numeric string status at runtime', () => {
    class NumericStringStatusHttpException extends HttpException {
      override getStatus(): number {
        return '400' as unknown as number;
      }
    }

    expect(
      mapErrorToResponse(
        new NumericStringStatusHttpException('untrusted framework message', 400),
        requestId,
      ),
    ).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });

  it('does not trust an HttpException lookalike', () => {
    const error = {
      getResponse: () => ({ token: 'secret-token' }),
      getStatus: () => HttpStatus.BAD_REQUEST,
      message: 'untrusted framework message',
    };

    expect(mapErrorToResponse(error, requestId)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    });
  });
});
