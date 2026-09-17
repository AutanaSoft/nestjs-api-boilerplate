import { describe, expect, it } from 'vitest';
import { buildShutdownConfig, shutdownConfigSchema } from './shutdown.config.js';

describe('buildShutdownConfig', () => {
  it('uses the default shutdown timeout', () => {
    expect(buildShutdownConfig({})).toEqual({ timeoutMs: 10_000 });
  });

  it('coerces a configured shutdown timeout', () => {
    expect(buildShutdownConfig({ SHUTDOWN_TIMEOUT_MS: '5000' })).toEqual({ timeoutMs: 5000 });
  });

  it.each([
    { SHUTDOWN_TIMEOUT_MS: '' },
    { SHUTDOWN_TIMEOUT_MS: 'not-a-number' },
    { SHUTDOWN_TIMEOUT_MS: '1.5' },
    { SHUTDOWN_TIMEOUT_MS: '0' },
    { SHUTDOWN_TIMEOUT_MS: '-1' },
  ])('rejects invalid shutdown input: %o', (environment) => {
    expect(() => buildShutdownConfig(environment)).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildShutdownConfig({});

    expect(shutdownConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(shutdownConfigSchema['~standard'].validate({ timeoutMs: '10000' })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
