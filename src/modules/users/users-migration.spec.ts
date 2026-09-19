import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../database/prisma/migrations/20260918000000_initial/migration.sql', import.meta.url),
  'utf8',
);

describe('Users migration', () => {
  it('uses the approved physical table, constraint, and index names', () => {
    expect(migration).toContain('CREATE TABLE "users"');
    expect(migration).toContain('CONSTRAINT "users_pkey" PRIMARY KEY ("id")');
    expect(migration).toContain('CREATE UNIQUE INDEX "users_email_key" ON "users"("email")');
    expect(migration).toContain(
      'CREATE INDEX "users_created_at_id_idx" ON "users"("created_at", "id")',
    );
    expect(migration).toContain(
      'CREATE INDEX "users_display_name_id_idx" ON "users"("display_name", "id")',
    );
  });

  it('advances updatedAt only when mutable User fields change', () => {
    expect(migration).toContain(
      'WHEN ((OLD."email", OLD."display_name") IS DISTINCT FROM (NEW."email", NEW."display_name"))',
    );
  });
});
