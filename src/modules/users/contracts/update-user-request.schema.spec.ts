import { describe, expect, it } from 'vitest';
import { updateUserRequestSchema } from './update-user-request.schema.js';
import { userSchema } from './user.schema.js';

describe('updateUserRequestSchema', () => {
  it('derives the required displayName field from the canonical user schema', () => {
    expect(updateUserRequestSchema.shape.displayName).toBe(userSchema.shape.displayName);
  });

  it('normalizes the required displayName', () => {
    expect(updateUserRequestSchema.parse({ displayName: ' Ada Lovelace ' })).toEqual({
      displayName: 'Ada Lovelace',
    });
  });

  it.each([
    null,
    {},
    { displayName: undefined },
    { email: 'ada@example.com', displayName: 'Ada Lovelace' },
    { id: '123e4567-e89b-42d3-a456-426614174000', displayName: 'Ada Lovelace' },
    { role: 'admin', displayName: 'Ada Lovelace' },
    { password: 'secret', displayName: 'Ada Lovelace' },
    { createdAt: '2026-01-01T00:00:00.000Z', displayName: 'Ada Lovelace' },
    { updatedAt: '2026-01-01T00:00:00.000Z', displayName: 'Ada Lovelace' },
    { displayName: 'A' },
  ])('rejects missing, extra, system-managed, and invalid input %#', (input) => {
    expect(() => updateUserRequestSchema.parse(input)).toThrow();
  });
});
