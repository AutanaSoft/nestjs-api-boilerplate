import { describe, expect, it } from 'vitest';
import { ApplicationError } from './application-error.js';

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
  existingValue: string;
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

describe('ApplicationError', () => {
  it('preserves typed resource-not-found context and an internal cause', () => {
    const cause = new Error('database lookup failed');
    const error = new ResourceNotFoundError({ resourceId: 'resource-123' }, { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.context).toEqual({ resourceId: 'resource-123' });
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('ResourceNotFoundError');
    expect(error.message).toBe('');
  });

  it('retains a distinct conflict context without a public message', () => {
    const error = new ConflictError({
      conflictingField: 'email',
      existingValue: 'user@example.com',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('CONFLICT');
    expect(error.context).toEqual({
      conflictingField: 'email',
      existingValue: 'user@example.com',
    });
    expect(error.cause).toBeUndefined();
    expect(error.name).toBe('ConflictError');
    expect(error.message).toBe('');
  });
});
