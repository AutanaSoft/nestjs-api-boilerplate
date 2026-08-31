import { describe, expect, it } from 'vitest';
import { buildHttpConfig, httpConfigSchema } from './http.config.js';

describe('buildHttpConfig', () => {
  it('uses development defaults', () => {
    expect(buildHttpConfig({})).toEqual({
      nodeEnv: 'development',
      port: 3000,
      corsOrigins: ['http://localhost:3000'],
      corsCredentials: false,
      throttle: {
        ttlMs: 60_000,
        limit: 100,
      },
      trustProxyHops: 0,
    });
  });

  it('coerces numeric environment values and normalizes origins', () => {
    expect(
      buildHttpConfig({
        NODE_ENV: 'test',
        PORT: '4000',
        CORS_ORIGINS: ' https://example.com/ ,http://localhost:3001 ',
        THROTTLE_TTL_SECONDS: '120',
        THROTTLE_LIMIT: '25',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 4000,
      corsOrigins: ['https://example.com', 'http://localhost:3001'],
      corsCredentials: false,
      throttle: {
        ttlMs: 120_000,
        limit: 25,
      },
      trustProxyHops: 1,
    });
  });

  it.each([
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: 'not-a-number' },
    { THROTTLE_TTL_SECONDS: '0' },
    { THROTTLE_LIMIT: '1.5' },
    { TRUST_PROXY_HOPS: '-1' },
  ])('rejects invalid numeric values: %o', (environment) => {
    expect(() => buildHttpConfig(environment)).toThrow();
  });

  it.each([
    '*',
    'https://example.com,,https://api.example.com',
    'https://example.com,https://example.com/',
    'ftp://example.com',
    'https://user:password@example.com',
    'https://example.com/api',
    'https://example.com?source=test',
    'https://example.com#section',
  ])('rejects invalid CORS origins: %s', (corsOrigins) => {
    expect(() => buildHttpConfig({ CORS_ORIGINS: corsOrigins })).toThrow();
  });

  it('requires an explicit non-empty CORS allowlist in production', () => {
    expect(() => buildHttpConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => buildHttpConfig({ NODE_ENV: 'production', CORS_ORIGINS: '   ' })).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildHttpConfig({});

    expect(httpConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(httpConfigSchema['~standard'].validate({ ...config, port: '3000' })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
