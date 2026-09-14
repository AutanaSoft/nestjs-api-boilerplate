import { describe, expect, it } from 'vitest';
import {
  buildOpenApiConfig,
  openapiConfigSchema,
  type OpenApiEnvironment,
} from './openapi.config.js';

describe('buildOpenApiConfig', () => {
  it('disables OpenAPI and uses the documented routes by default', () => {
    expect(buildOpenApiConfig({})).toEqual({
      enabled: false,
      docsRoute: 'docs',
      documentRoute: 'openapi.json',
    });
  });

  it('accepts a valid enabled configuration with custom relative routes', () => {
    expect(
      buildOpenApiConfig({
        OPENAPI_ENABLED: 'true',
        OPENAPI_DOCS_ROUTE: 'platform/docs',
        OPENAPI_DOCUMENT_ROUTE: 'platform/openapi.json',
      }),
    ).toEqual({
      enabled: true,
      docsRoute: 'platform/docs',
      documentRoute: 'platform/openapi.json',
    });
  });

  it.each([
    { OPENAPI_DOCS_ROUTE: '/docs' },
    { OPENAPI_DOCS_ROUTE: 'docs/' },
    { OPENAPI_DOCS_ROUTE: 'platform//docs' },
    { OPENAPI_DOCS_ROUTE: '.' },
    { OPENAPI_DOCS_ROUTE: '..' },
    { OPENAPI_DOCS_ROUTE: 'platform/./docs' },
    { OPENAPI_DOCS_ROUTE: 'platform/../docs' },
    { OPENAPI_DOCS_ROUTE: 'api docs' },
    { OPENAPI_DOCS_ROUTE: 'docs?format=json' },
    { OPENAPI_DOCS_ROUTE: 'docs#api' },
  ])('rejects malformed documentation routes: %o', (environment) => {
    expect(() => buildOpenApiConfig(environment)).toThrow();
  });

  it('rejects equal documentation and document routes', () => {
    expect(() =>
      buildOpenApiConfig({
        OPENAPI_DOCS_ROUTE: 'openapi',
        OPENAPI_DOCUMENT_ROUTE: 'openapi',
      }),
    ).toThrow();
  });

  it.each(['TRUE', 'false ', '1', 'yes', ''])('rejects invalid enabled values: %s', (value) => {
    const environment: unknown = { OPENAPI_ENABLED: value };

    expect(() => buildOpenApiConfig(environment as OpenApiEnvironment)).toThrow();
  });

  it('validates the final runtime shape through Standard Schema', () => {
    const config = buildOpenApiConfig({ OPENAPI_ENABLED: 'true' });

    expect(openapiConfigSchema['~standard'].validate(config)).toEqual({ value: config });
    expect(openapiConfigSchema['~standard'].validate({ ...config, enabled: 'true' })).toMatchObject(
      {
        issues: expect.any(Array),
      },
    );
  });
});
