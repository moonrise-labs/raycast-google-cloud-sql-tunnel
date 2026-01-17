import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
