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
});
