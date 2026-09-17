import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
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
    include: ['**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
});
