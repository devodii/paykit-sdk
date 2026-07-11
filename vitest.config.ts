import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      {
        find: '@paykit-sdk/core',
        replacement: resolve(
          __dirname,
          'packages/paykit/src/index.ts',
        ),
      },
      // The paypal package deep-imports a types-only path that its
      // tsup plugin rewrites at build time; mirror that rewrite here.
      {
        find: /^@paypal\/paypal-server-sdk\/dist\/types\/(.*)$/,
        replacement: '@paypal/paypal-server-sdk/dist/esm/$1.js',
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
