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
    include: ['test/shutdown/graceful-shutdown.process.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
