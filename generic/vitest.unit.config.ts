import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests that run in Node: the server, the domain layer and plain functions.
// A test that needs a browser is named `*.browser.test.ts(x)` and belongs to
// the pages project instead.
export default defineConfig({
  test: {
    name: 'unit',
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.databricks/**',
      '**/.stryker-tmp/**',
      '**/*.browser.test.*',
      'features/**',
    ],
    server: {
      deps: {
        // echarts-for-react's ESM build has extensionless imports Node rejects.
        inline: [/@databricks\/appkit-ui/, 'echarts-for-react'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
