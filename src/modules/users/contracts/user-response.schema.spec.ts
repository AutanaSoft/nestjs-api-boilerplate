import { describe, expect, expectTypeOf, it } from 'vitest';
import { toOpenApiSchema } from '../../../common/openapi/openapi-schema.js';
import { userResponseSchema } from './user-response.schema.js';
import { userSchema } from './user.schema.js';
import type { UserResponse, UserResponseInput } from './user-response.schema.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:35:56.789Z'),
};

describe('userResponseSchema', () => {
  it('composes canonical user fields while replacing timestamps for serialization', () => {
    expect(userResponseSchema.shape.id).toBe(userSchema.shape.id);
    expect(userResponseSchema.shape.email).toBe(userSchema.shape.email);
    expect(userResponseSchema.shape.displayName).toBe(userSchema.shape.displayName);
    expect(userResponseSchema.shape.createdAt).not.toBe(userSchema.shape.createdAt);
    expect(userResponseSchema.shape.updatedAt).not.toBe(userSchema.shape.updatedAt);
  });

  it('exports distinct input and output timestamp types', () => {
    expectTypeOf<UserResponseInput['createdAt']>().toEqualTypeOf<Date>();
    expectTypeOf<UserResponse['createdAt']>().toEqualTypeOf<string>();
  });

  it('serializes Prisma Date values as public ISO 8601 timestamp strings', () => {
    expect(userResponseSchema.parse(user)).toEqual({
      ...user,
      createdAt: '2026-09-19T12:34:56.789Z',
      updatedAt: '2026-09-19T12:35:56.789Z',
    });
  });

  it('accepts Date input only before serializing timestamps', () => {
    expect(() =>
      userResponseSchema.parse({
        ...user,
        createdAt: '2026-09-19T12:34:56.789Z',
        updatedAt: '2026-09-19T12:35:56.789Z',
      }),
    ).toThrow();
  });

  it('generates an OpenAPI-representable public string timestamp contract', () => {
    const schema = toOpenApiSchema(userResponseSchema, 'output');

    expect(schema).toMatchObject({
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    });
  });
});
