import { describe, expect, it } from 'vitest';
import { apiConfigSchema, buildApiConfig } from './api.config.js';

describe('buildApiConfig', () => {
  it('uses the default global prefix', () => {
    expect(buildApiConfig({})).toEqual({ globalPrefix: 'api' });
  });

  it('preserves an explicit empty global prefix', () => {
    expect(buildApiConfig({ API_GLOBAL_PREFIX: '' })).toEqual({ globalPrefix: '' });
  });

  it.each([
    { API_GLOBAL_PREFIX: '/api' },
    { API_GLOBAL_PREFIX: 'api/' },
    { API_GLOBAL_PREFIX: 'platform//api' },
    { API_GLOBAL_PREFIX: '.' },
    { API_GLOBAL_PREFIX: '..' },
    { API_GLOBAL_PREFIX: 'platform/./api' },
    { API_GLOBAL_PREFIX: 'platform/../api' },
    { API_GLOBAL_PREFIX: 'platform api' },
    { API_GLOBAL_PREFIX: 'api?version=1' },
    { API_GLOBAL_PREFIX: 'api#v1' },
  ])('rejects an invalid global prefix: %o', (environment) => {
    expect(() => buildApiConfig(environment)).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildApiConfig({ API_GLOBAL_PREFIX: 'platform/api' });

    expect(apiConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(apiConfigSchema['~standard'].validate({ globalPrefix: '/api' })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
