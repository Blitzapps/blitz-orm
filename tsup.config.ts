import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	target: 'esnext',
	clean: true,
	treeshake: true,
	minify: false,
	sourcemap: true,
	esbuildOptions(options) {
		// eslint-disable-next-line no-param-reassign
		options.define = {
			'process.env.npm_package_version': `"${pkg.version}"`,
		};
	},
});
