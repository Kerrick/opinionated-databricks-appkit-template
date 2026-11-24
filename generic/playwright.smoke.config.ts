import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { browserLaunchOptions } from './tools/browser-libraries.ts';

// Smoke: the journeys tagged `@smoke`, run against the deployed app with
// nothing faked. Needs a deployed workspace, so it never runs in `check`.
//
//   APP_URL     where the deployed app lives (required)
//   APP_TOKEN   a bearer token that gets past the workspace's sign-in, if the
//               app sits behind it (optional)
const appUrl = process.env['APP_URL'];
const token = process.env['APP_TOKEN'];

process.env['JOURNEY_TARGET'] = 'deployed';

const testDir = defineBddConfig({
  features: 'features/journeys/**/*.feature',
  steps: 'features/steps/journeys.steps.ts',
  tags: '@smoke',
  outputDir: '.features-gen/smoke',
});

export default defineConfig({
  testDir,
  // Fails with a plain message, before any test, when there is nothing to test.
  globalSetup: './features/mocks/require-app-url.ts',
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    launchOptions: browserLaunchOptions(),
    ...(token ? { extraHTTPHeaders: { Authorization: `Bearer ${token}` } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
