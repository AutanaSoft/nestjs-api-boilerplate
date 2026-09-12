import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
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
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    root: './',
    include: ['test/main.e2e-spec.ts'],
    env: {
      CORS_ORIGINS: 'https://allowed.example',
      CORS_MAX_AGE_SECONDS: '600',
      THROTTLE_LIMIT: '2',
      THROTTLE_TTL_SECONDS: '60',
    },
  },
});
