import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    root: './',
    include: ['test/main.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      API_GLOBAL_PREFIX: 'api',
      TRUST_PROXY_HOPS: '0',
      CORS_ORIGINS: 'https://allowed.example',
      CORS_MAX_AGE_SECONDS: '600',
      OPENAPI_ENABLED: 'false',
      OPENAPI_DOCS_ROUTE: 'docs',
      OPENAPI_DOCUMENT_ROUTE: 'openapi.json',
      THROTTLE_LIMIT: '2',
      THROTTLE_TTL_SECONDS: '60',
    },
  },
});
