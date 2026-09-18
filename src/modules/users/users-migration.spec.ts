import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../prisma/migrations/20260919000000_add_users/migration.sql', import.meta.url),
  'utf8',
);

describe('Users migration', () => {
  it('advances updatedAt only when mutable User fields change', () => {
    expect(migration).toContain(
      'WHEN ((OLD."email", OLD."displayName") IS DISTINCT FROM (NEW."email", NEW."displayName"))',
    );
  });
});
