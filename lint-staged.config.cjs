/* eslint-disable no-undef */
module.exports = {
  '*.{js,jsx,ts,tsx,json}': ['npx biome check --staged'],
  '**/*.ts?(x)': () => 'pnpm run types',
};
