import { readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig, Options } from 'tsup';

export function createTsupConfig(
  options: Options = {},
): ReturnType<typeof defineConfig> {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  );

  return defineConfig({
    entry: ['src/**/*.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    define: {
      'process.env.SDK_VERSION': JSON.stringify(pkg.version),
    },
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.js' : '.mjs',
      };
    },
    ...options,
  });
}
