import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.databricks/**'],
    server: {
      deps: {
        // echarts-for-react's ESM build has extensionless imports Node rejects.
        inline: [/@databricks\/appkit-ui/, 'echarts-for-react'],
      },
    },
    coverage: {
      provider: 'v8',
      // Every source file counts, including ones no test loads, so an untested file shows up as 0%.
      include: ['client/src/**/*.{ts,tsx}', 'server/**/*.ts'],
      // Tests, type declarations, and the two files that only start the app. Each of the starts is
      // exercised by the journeys, not by unit tests.
      exclude: ['**/*.test.*', '**/*.d.ts', 'client/src/main.tsx', 'server/server.ts'],
      // Every line, branch, function and statement of every file, so a gap can't hide behind a healthy average.
      thresholds: { 100: true, perFile: true },
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
