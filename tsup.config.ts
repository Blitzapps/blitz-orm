import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	target: 'esnext',
	clean: true,
	treeshake: true,
	minify: true,
	sourcemap: true,
	define: {
		'"__VERSION__"': JSON.stringify(pkg.version),
	},
});
