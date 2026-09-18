import { describe, expect, it } from 'vitest';
import { createUserRequestSchema } from './create-user-request.schema.js';
import { userSchema } from './user.schema.js';

describe('createUserRequestSchema', () => {
  it('picks its canonical normalized fields from userSchema', () => {
    expect(createUserRequestSchema.shape.email).toBe(userSchema.shape.email);
    expect(createUserRequestSchema.shape.displayName).toBe(userSchema.shape.displayName);
  });

  it('normalizes email and display name before validating their public contract', () => {
    expect(
      createUserRequestSchema.parse({
        email: '  Ada.Lovelace+api@Example.COM  ',
        displayName: '  Ada Lovelace  ',
      }),
    ).toEqual({
      email: 'ada.lovelace+api@example.com',
      displayName: 'Ada Lovelace',
    });
  });

  it.each([
    ['Al', 'two ASCII Unicode code points'],
    ['A'.repeat(30), 'thirty Unicode code points'],
    ['Élodie', 'non-ASCII Unicode letters'],
  ])('accepts %s with %s', (displayName) => {
    expect(createUserRequestSchema.parse({ email: 'ada@example.com', displayName })).toMatchObject({
      displayName,
    });
  });

  it.each([
    { email: 'ada@example.com', displayName: 'A'.repeat(31) },
    { email: 'ada@example.com', displayName: 'Ada  Lovelace' },
    { email: 'ada@example.com', displayName: 'Ada\tLovelace' },
    { email: 'ada@example.com', displayName: 'Ada 1' },
    { email: 'ada@example.com', displayName: 'A' },
    { email: 'not-an-email', displayName: 'Ada Lovelace' },
    { email: 'ada@example.com', displayName: 'Ada Lovelace', id: 'client-id' },
    { email: 'ada@example.com', displayName: 'Ada Lovelace', createdAt: '2026-01-01T00:00:00Z' },
    { email: 'ada@example.com', displayName: 'Ada Lovelace', updatedAt: '2026-01-01T00:00:00Z' },
  ])('rejects invalid or client-managed input %#', (input) => {
    expect(() => createUserRequestSchema.parse(input)).toThrow();
  });
});
