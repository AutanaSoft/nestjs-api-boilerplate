import { describe, expect, it } from 'vitest';
import { appConfigFactory, appConfigSchema } from './app.config.js';

describe('appConfigFactory', () => {
  it('uses the agreed application metadata defaults', () => {
    expect(appConfigFactory({})).toEqual({
      nodeEnv: 'development',
      name: 'NestJS 12 API',
      description: 'A secure NestJS 12 API boilerplate for TypeScript applications.',
      version: '0.0.1',
    });
  });

  it('uses non-empty metadata overrides', () => {
    expect(
      appConfigFactory({
        NODE_ENV: 'test',
        APP_NAME: 'Test API',
        APP_DESCRIPTION: 'Test description',
        APP_VERSION: '1.2.3',
      }),
    ).toEqual({
      nodeEnv: 'test',
      name: 'Test API',
      description: 'Test description',
      version: '1.2.3',
    });
  });

  it.each([{ NODE_ENV: '' }, { APP_NAME: '' }, { APP_DESCRIPTION: '   ' }, { APP_VERSION: '' }])(
    'rejects empty application metadata: %o',
    (environment) => {
      expect(() => appConfigFactory(environment)).toThrow();
    },
  );

  it('validates the final runtime shape through Standard Schema', () => {
    const config = appConfigFactory({});

    expect(appConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(appConfigSchema['~standard'].validate({ ...config, version: 1 })).toMatchObject({
      issues: expect.any(Array),
    });
  });
});
