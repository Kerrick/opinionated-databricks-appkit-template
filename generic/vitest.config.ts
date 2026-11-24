import { defineConfig } from 'vitest/config';

// Two projects: code that runs in Node, and pages and components that need a
// real browser. Each lives in its own file so mutation testing can run the
// Node one alone.
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.pages.config.ts'],
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
});
