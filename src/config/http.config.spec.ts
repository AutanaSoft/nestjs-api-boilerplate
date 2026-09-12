import { describe, expect, it } from 'vitest';
import { buildHttpConfig, httpConfigSchema } from './http.config.js';

describe('buildHttpConfig', () => {
  it('uses the HTTP defaults', () => {
    expect(buildHttpConfig({})).toEqual({
      port: 3000,
      trustProxyHops: 0,
    });
  });

  it('coerces configured HTTP values', () => {
    expect(
      buildHttpConfig({
        PORT: '4000',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toEqual({
      port: 4000,
      trustProxyHops: 1,
    });
  });

  it.each([
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: 'not-a-number' },
    { TRUST_PROXY_HOPS: '-1' },
    { TRUST_PROXY_HOPS: '256' },
  ])('rejects invalid HTTP input: %o', (environment) => {
    expect(() => buildHttpConfig(environment)).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildHttpConfig({});

    expect(httpConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(httpConfigSchema['~standard'].validate({ ...config, port: '3000' })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
