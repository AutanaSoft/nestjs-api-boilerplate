import { describe, expect, it } from 'vitest';
import { listUsersRequestSchema } from './list-users-request.schema.js';
import { queryUsersRequestSchema } from './query-users-request.schema.js';

describe('listUsersRequestSchema', () => {
  it('normalizes the exact email filter and applies collection defaults', () => {
    expect(listUsersRequestSchema.parse({ email: ' Ada@Example.COM ' })).toEqual({
      email: 'ada@example.com',
      sort: 'createdAt',
      direction: 'desc',
      limit: 25,
    });
  });

  it('normalizes a structured query and maps it to the canonical list request', () => {
    expect(
      queryUsersRequestSchema.parse({
        criteria: { email: ' Ada@Example.COM ' },
        limit: 1,
      }),
    ).toEqual({
      email: 'ada@example.com',
      sort: 'createdAt',
      direction: 'desc',
      limit: 1,
    });
  });

  it.each([
    null,
    [],
    {},
    { criteria: null },
    { criteria: [] },
    { criteria: {} },
    { criteria: { email: null } },
    { criteria: { email: 'ada@example.com', displayName: 'Ada' } },
    { criteria: { email: 'ada@example.com' }, unknown: 'value' },
    { criteria: { email: 'ada@example.com' }, after: 'a', before: 'b' },
    { criteria: { email: 'ada@example.com' }, limit: '25' },
  ])('rejects invalid structured query input %j', (body) => {
    expect(() => queryUsersRequestSchema.parse(body)).toThrow();
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
