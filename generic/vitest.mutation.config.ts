import { defineConfig } from 'vitest/config';
import path from 'node:path';

// The unit tests that mutation testing runs: those beside the code it mutates. The server's tests are left
// out because they boot an AppKit app, which crashes the test runner mutation testing uses. The repository checks
// in tools/ are left out too, because every mutant would otherwise rerun them for nothing.
export default defineConfig({
  test: {
    name: 'mutation',
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: ['client/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.databricks/**', '**/*.browser.test.*'],
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
