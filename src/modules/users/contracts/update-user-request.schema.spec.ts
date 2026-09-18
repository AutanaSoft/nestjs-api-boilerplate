import { describe, expect, it } from 'vitest';
import { updateUserRequestSchema } from './update-user-request.schema.js';
import { userSchema } from './user.schema.js';

describe('updateUserRequestSchema', () => {
  it('derives optional mutable fields from the canonical user schema', () => {
    expect(updateUserRequestSchema.shape.email.unwrap()).toBe(userSchema.shape.email);
    expect(updateUserRequestSchema.shape.displayName.unwrap()).toBe(userSchema.shape.displayName);
  });

  it('normalizes supplied fields while preserving omitted fields', () => {
    expect(updateUserRequestSchema.parse({ email: ' Ada.Lovelace@Example.COM ' })).toEqual({
      email: 'ada.lovelace@example.com',
    });
    expect(updateUserRequestSchema.parse({ displayName: ' Ada Lovelace ' })).toEqual({
      displayName: 'Ada Lovelace',
    });
  });

  it.each([
    null,
    {},
    { email: undefined },
    { id: '123e4567-e89b-42d3-a456-426614174000' },
    { role: 'admin' },
    { createdAt: '2026-01-01T00:00:00.000Z' },
    { updatedAt: '2026-01-01T00:00:00.000Z' },
    { email: 'not-an-email' },
    { displayName: 'A' },
  ])('rejects null, empty, system-managed, and invalid input %#', (input) => {
    expect(() => updateUserRequestSchema.parse(input)).toThrow();
  });
});
