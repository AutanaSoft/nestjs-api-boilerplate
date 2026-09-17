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
    include: ['test/shutdown/graceful-shutdown.process.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
