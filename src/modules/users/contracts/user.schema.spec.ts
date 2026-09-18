import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { displayNameSchema, normalizedEmailSchema, userSchema } from './user.schema.js';
import type { User } from './user.schema.js';

const user = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  email: '  Ada@Example.COM  ',
  displayName: 'Ada Lovelace',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
  updatedAt: new Date('2026-09-19T12:35:56.789Z'),
};

describe('userSchema', () => {
  it('exports User as the schema output type', () => {
    expectTypeOf<User>().toEqualTypeOf<z.output<typeof userSchema>>();
  });

  it('composes canonical normalized field schemas', () => {
    expect(userSchema.shape.email).toBe(normalizedEmailSchema);
    expect(userSchema.shape.displayName).toBe(displayNameSchema);
  });

  it('owns the normalized internal User value with Date timestamps', () => {
    expect(userSchema.parse(user)).toEqual({
      ...user,
      email: 'ada@example.com',
    });
  });

  it.each(['A', 'Ada  Lovelace', 'Ada 1'])('rejects invalid display name %j', (displayName) => {
    expect(() => userSchema.parse({ ...user, displayName })).toThrow();
  });

  it('rejects serialized timestamp strings from the application value', () => {
    expect(() =>
      userSchema.parse({
        ...user,
        createdAt: '2026-09-19T12:34:56.789Z',
        updatedAt: '2026-09-19T12:34:56.789Z',
      }),
    ).toThrow();
  });
});
