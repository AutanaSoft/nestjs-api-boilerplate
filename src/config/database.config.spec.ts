import { describe, expect, it } from 'vitest';
import { buildDatabaseConfig, databaseConfigSchema } from './database.config.js';

describe('buildDatabaseConfig', () => {
  it('exposes a validated PostgreSQL connection URL', () => {
    const config = buildDatabaseConfig({
      DATABASE_URL: 'postgresql://application:secret@localhost:5432/application',
    });

    expect(config).toEqual({
      url: 'postgresql://application:secret@localhost:5432/application',
    });
    expect(databaseConfigSchema['~standard'].validate(config)).toEqual({ value: config });
  });

  it.each([
    {},
    { DATABASE_URL: '' },
    { DATABASE_URL: 'mysql://application:secret@localhost:3306/application' },
    { DATABASE_URL: 'not a URL' },
  ])('rejects an invalid database URL: %o', (environment) => {
    expect(() => buildDatabaseConfig(environment)).toThrow();
  });
});
