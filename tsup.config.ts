// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, Options } from 'tsup';

export default defineConfig((options: Options) => ({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  ...options,
}));
