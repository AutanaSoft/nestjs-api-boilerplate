import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { toOpenApiSchema } from './openapi-schema.js';

const transformedLengthSchema = z.string().transform((value) => value.length);

describe('toOpenApiSchema', () => {
  it('converts output schemas directly for response contracts', () => {
    const schema = z.object({ status: z.literal('ok'), nullable: z.string().nullable() });

    expect(toOpenApiSchema(schema, 'output')).toEqual({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        nullable: { nullable: true, type: 'string' },
      },
      required: ['status', 'nullable'],
      additionalProperties: false,
    });
  });

  it('converts transformed schemas from their input boundary', () => {
    expect(toOpenApiSchema(transformedLengthSchema, 'input')).toEqual({ type: 'string' });
  });

  it('preserves Zod output conversion failures for unrepresentable transforms', () => {
    expect(() => toOpenApiSchema(transformedLengthSchema, 'output')).toThrow(
      'Transforms cannot be represented in JSON Schema',
    );
  });
});
