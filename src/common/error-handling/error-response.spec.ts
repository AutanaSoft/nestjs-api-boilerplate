import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ErrorResponse } from './error-response.js';

type ValidationDetails = Readonly<{
  field: string;
}>;

describe('ErrorResponse', () => {
  it('models the shared public error fields and permits omitted details', () => {
    const response: ErrorResponse = {
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: 'f5eb2c44-618c-4ea4-90f5-4c32a6d306c4',
    };

    expect(response).toEqual({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: 'f5eb2c44-618c-4ea4-90f5-4c32a6d306c4',
    });
    expect('details' in response).toBe(false);
  });

  it('permits details only when its public contract is explicit', () => {
    const response: ErrorResponse<ValidationDetails> = {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'The request is invalid.',
      requestId: 'f5eb2c44-618c-4ea4-90f5-4c32a6d306c4',
      details: { field: 'email' },
    };

    expectTypeOf<ErrorResponse['details']>().toEqualTypeOf<undefined>();
    expectTypeOf(response.details).toEqualTypeOf<ValidationDetails | undefined>();
  });
});
