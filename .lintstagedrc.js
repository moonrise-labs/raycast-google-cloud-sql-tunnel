/** @type {import('lint-staged').Config} */
export default {
  '*.{js,jsx,ts,tsx}': ['bunx eslint --fix'],
  '*.{json,md,yml}': ['bunx eslint --fix'],
};
