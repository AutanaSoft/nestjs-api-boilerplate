import { describe, expect, it } from 'vitest';
import { buildRateLimitConfig, rateLimitConfigSchema } from './rate-limit.config.js';

describe('buildRateLimitConfig', () => {
  it('uses the global rate limit defaults and converts seconds to milliseconds', () => {
    expect(buildRateLimitConfig({})).toEqual({
      global: {
        ttlMs: 60_000,
        limit: 100,
      },
    });
  });

  it('coerces configured global limits', () => {
    expect(
      buildRateLimitConfig({
        THROTTLE_TTL_SECONDS: '120',
        THROTTLE_LIMIT: '25',
      }),
    ).toEqual({
      global: {
        ttlMs: 120_000,
        limit: 25,
      },
    });
  });

  it.each([
    { THROTTLE_TTL_SECONDS: '0' },
    { THROTTLE_TTL_SECONDS: '1.5' },
    { THROTTLE_LIMIT: '-1' },
    { THROTTLE_LIMIT: '1.5' },
  ])('rejects invalid rate limit input: %o', (environment) => {
    expect(() => buildRateLimitConfig(environment)).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildRateLimitConfig({});

    expect(rateLimitConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(rateLimitConfigSchema['~standard'].validate({ global: { ttlMs: 0, limit: 100 } })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
