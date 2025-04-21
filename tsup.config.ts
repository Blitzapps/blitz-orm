import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
	noExternal: ["robot3"], //needed because is not ESM
  dts: true,
  target: 'esnext',
  clean: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  esbuildOptions(options) {
    // eslint-disable-next-line no-param-reassign
    options.define = {
      'process.env.npm_package_version': `"${pkg.version}"`,
    };
  },
});
