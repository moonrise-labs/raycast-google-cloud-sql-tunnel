/** @type {import('lint-staged').Config} */
export default {
  '*.{js,jsx,ts,tsx}': ['bun run eslint --fix', () => 'bun run tsc --noEmit -p tsconfig.json'],
  '*.{json,md,yml}': ['bun run eslint --fix'],
};
