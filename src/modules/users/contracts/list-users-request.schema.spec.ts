import { describe, expect, it } from 'vitest';
import { listUsersRequestSchema } from './list-users-request.schema.js';

describe('listUsersRequestSchema', () => {
  it('normalizes the exact email filter and applies collection defaults', () => {
    expect(listUsersRequestSchema.parse({ email: ' Ada@Example.COM ' })).toEqual({
      email: 'ada@example.com',
      sort: 'createdAt',
      direction: 'desc',
      limit: 25,
    });
  });

  it.each([
    { limit: '0' },
    { limit: '251' },
    { limit: '1.5' },
    { limit: ['25'] },
    { sort: 'email' },
    { direction: 'sideways' },
    { after: 'a', before: 'b' },
    { email: ['ada@example.com'] },
    { unknown: 'value' },
  ])('rejects unsupported, repeated, or invalid query input %j', (query) => {
    expect(() => listUsersRequestSchema.parse(query)).toThrow();
  });
});
