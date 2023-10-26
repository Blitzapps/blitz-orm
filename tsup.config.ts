// eslint-disable-next-line import/no-extraneous-dependencies
import type { Options } from 'tsup';
import { defineConfig } from 'tsup';

export default defineConfig((options: Options) => ({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	...options,
}));
