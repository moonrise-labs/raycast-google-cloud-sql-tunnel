import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@raycast/api': path.join(rootDir, 'src/__tests__/raycast-api.ts'),
    },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/__tests__/**'],
    },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
