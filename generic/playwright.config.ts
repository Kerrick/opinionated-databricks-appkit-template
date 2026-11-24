import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { browserLaunchOptions } from './tools/browser-libraries.ts';
import { freePort } from './tools/free-port.ts';

// Journeys: the built app (`pnpm run build` first) in a real browser, with the
// browser's calls to `/api/` faked. They need no workspace and no credentials.
// The port is one the system hands out for this run, so two runs on one machine (two checkouts, two worktrees,
// two CI jobs) never fight over one. Playwright loads this file again in each worker, so the choice is kept in the
// environment, which the workers inherit. `JOURNEY_PORT` overrides it.
const port = Number((process.env['JOURNEY_PORT'] ??= String(await freePort())));

const testDir = defineBddConfig({
  features: 'features/journeys/**/*.feature',
  steps: 'features/steps/journeys.steps.ts',
  outputDir: '.features-gen/journeys',
});

// A browser has to run here, so the limits are stated, not left at Playwright's defaults (a test 30 s, an
// assertion 5 s, the server's start 60 s). With busy loops on every core and the app built, the slower journey takes
// about 1 s on an idle machine and 6 s with 8 loops per core. With 32 per core it took 35 s and failed its 30 s,
// and with 64 per core the server did not start within a minute. A test gets 120 s, an assertion 30 s and the
// server 240 s, so a journey fails when the app is wrong and not when the machine is busy.
export default defineConfig({
  testDir,
  timeout: 120_000,
  expect: { timeout: 30_000 },
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
    timeout: 240_000,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
