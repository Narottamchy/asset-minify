import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: false, // Keep it readable for code audits and open source, compression is not an issue for CLI size
  sourcemap: true,
  shims: true, // Injects ESM equivalents of __dirname, __filename, and require()
  target: 'node16',
  splitting: false,
  treeshake: true,
});
