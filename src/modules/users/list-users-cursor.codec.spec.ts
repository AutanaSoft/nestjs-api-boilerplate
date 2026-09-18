import { describe, expect, it } from 'vitest';
import { decodeListUsersCursor, encodeListUsersCursor } from './list-users-cursor.codec.js';

const context = {
  email: 'ada@example.com',
  sort: 'createdAt' as const,
  direction: 'desc' as const,
};
const position = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  createdAt: new Date('2026-09-19T12:34:56.789Z'),
};

describe('list users cursor codec', () => {
  it('round-trips a versioned opaque base64url cursor bound to its query context', () => {
    const cursor = encodeListUsersCursor(context, position);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeListUsersCursor(cursor, context)).toEqual(position);
  });

  it.each([
    'not-base64!',
    Buffer.from('{"v":2}', 'utf8').toString('base64url'),
    Buffer.from('{"v":1,"email":null,"sort":"createdAt","direction":"desc"}', 'utf8').toString(
      'base64url',
    ),
    'a'.repeat(1025),
  ])('rejects malformed or unsupported cursors', (cursor) => {
    expect(() => decodeListUsersCursor(cursor, context)).toThrow();
  });

  it('rejects cursors from another normalized filter, sort, or direction', () => {
    const cursor = encodeListUsersCursor(context, position);

    expect(() => decodeListUsersCursor(cursor, { ...context, direction: 'asc' })).toThrow();
    expect(() => decodeListUsersCursor(cursor, { ...context, email: undefined })).toThrow();
  });
});
