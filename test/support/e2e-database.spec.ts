import { describe, expect, it } from 'vitest';
import { parseE2EDatabaseAdminUrl } from './e2e-database.js';

describe('parseE2EDatabaseAdminUrl', () => {
  it('accepts a loopback PostgreSQL maintenance database URL', () => {
    expect(
      parseE2EDatabaseAdminUrl('postgresql://postgres:postgres@127.0.0.1:5432/postgres'),
    ).toEqual(new URL('postgresql://postgres:postgres@127.0.0.1:5432/postgres'));
  });

  it.each([
    undefined,
    'mysql://postgres:postgres@127.0.0.1:3306/postgres',
    'postgresql://postgres:postgres@database.example:5432/postgres',
    'postgresql://postgres:postgres@127.0.0.1:5432/application',
  ])('rejects an unsafe E2E administrative URL: %s', (url) => {
    expect(() => parseE2EDatabaseAdminUrl(url)).toThrow();
  });
});
