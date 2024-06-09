import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'], // Output both ES modules and CommonJS modules
	dts: true,
	target: 'esnext',
	clean: true,
	treeshake: true,
	minify: true,
	sourcemap: true,
});
