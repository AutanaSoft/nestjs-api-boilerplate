import { describe, expect, it } from 'vitest';
import { buildCorsConfig, corsConfigSchema } from './cors.config.js';

describe('buildCorsConfig', () => {
  it('uses the development allowlist and explicit CORS policy defaults', () => {
    expect(buildCorsConfig({})).toEqual({
      origins: ['http://localhost:3000'],
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'QUERY'],
      allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      credentials: false,
      maxAge: 600,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  });

  it('normalizes origins and accepts a max-age override of zero', () => {
    expect(
      buildCorsConfig({
        CORS_ORIGINS: ' https://example.com/ ,http://localhost:3001 ',
        CORS_MAX_AGE_SECONDS: '0',
      }),
    ).toMatchObject({
      origins: ['https://example.com', 'http://localhost:3001'],
      maxAge: 0,
    });
  });

  it.each([
    { CORS_MAX_AGE_SECONDS: '-1' },
    { CORS_MAX_AGE_SECONDS: '86401' },
    { CORS_MAX_AGE_SECONDS: '1.5' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com,,https://api.example.com' },
    { CORS_ORIGINS: 'https://example.com,https://example.com/' },
    { CORS_ORIGINS: 'ftp://example.com' },
    { CORS_ORIGINS: 'https://user:password@example.com' },
    { CORS_ORIGINS: 'https://example.com/api' },
    { CORS_ORIGINS: 'https://example.com?source=test' },
    { CORS_ORIGINS: 'https://example.com#section' },
  ])('rejects invalid CORS input: %o', (environment) => {
    expect(() => buildCorsConfig(environment)).toThrow();
  });

  it('requires an explicit non-empty allowlist in production', () => {
    expect(() => buildCorsConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => buildCorsConfig({ NODE_ENV: 'production', CORS_ORIGINS: '   ' })).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildCorsConfig({});

    expect(corsConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(corsConfigSchema['~standard'].validate({ ...config, maxAge: '600' })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
