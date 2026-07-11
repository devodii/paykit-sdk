import { readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig, Options } from 'tsup';

export function createTsupConfig(
  options: Options = {},
): ReturnType<typeof defineConfig> {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  );

  const type = pkg?.paykit?.type || 'unknown';

  return defineConfig({
    entry: ['src/**/*.ts', '!src/**/*.test.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    define: {
      ...(type === 'core' && {
        'process.env.SDK_VERSION': JSON.stringify(pkg.version),
      }),
      ...((type === 'provider' || type === 'unknown') && {
        'process.env.PROVIDER_VERSION': JSON.stringify(pkg.version),
      }),
      ...(type === 'adapter' && {
        'process.env.ADAPTER_VERSION': JSON.stringify(pkg.version),
      }),
    },
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.js' : '.mjs',
      };
    },
    ...options,
  });
}
