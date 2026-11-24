import { defineConfig, devices } from '@playwright/test';
import { createHash } from 'node:crypto';
import { defineBddConfig } from 'playwright-bdd';
import { browserLaunchOptions } from './tools/browser-libraries.ts';

// Journeys: the built app (`pnpm run build` first) in a real browser, with the
// browser's calls to `/api/` faked. They need no workspace and no credentials.
// The port comes from where the project sits, so two copies of it on one machine (two checkouts, two
// worktrees) don't fight over one. `JOURNEY_PORT` overrides it.
const port = Number(
  process.env['JOURNEY_PORT'] ?? 4000 + (createHash('sha256').update(process.cwd()).digest().readUInt16BE() % 4000)
);

const testDir = defineBddConfig({
  features: 'features/journeys/**/*.feature',
  steps: 'features/steps/journeys.steps.ts',
  outputDir: '.features-gen/journeys',
});

export default defineConfig({
  testDir,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: browserLaunchOptions(),
  },
  webServer: {
    // AppKit's server, serving the built client, with its Databricks calls answered by a fake in its own process.
    command: 'node --import tsx --import ./features/mocks/fake-databricks.ts ./features/mocks/journey-server.ts',
    env: {
      NODE_ENV: 'production',
      DATABRICKS_APP_PORT: String(port),
      DATABRICKS_HOST: 'https://journeys.invalid',
      DATABRICKS_TOKEN: 'journeys-token',
    },
    url: `http://localhost:${port}/health`,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
