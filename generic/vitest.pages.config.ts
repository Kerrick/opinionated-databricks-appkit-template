import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { quickpickle } from 'quickpickle';
import { browserLaunchOptions } from './tools/browser-libraries.ts';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The service worker that lets the page-level tests fake `/api/` requests.
// It is served straight from the msw package, so no copy is committed.
function serveMockServiceWorker(): Plugin {
  const workerFile = fileURLToPath(import.meta.resolve('msw/mockServiceWorker.js'));
  return {
    name: 'serve-mock-service-worker',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(readFileSync(workerFile));
      });
    },
  };
}

// Pages and components, rendered in a real browser, with the network faked.
// Scenarios in `features/pages/` run here through QuickPickle.
export default defineConfig({
  plugins: [
    // No React Compiler here: its generated caching branches only run on a second render, which
    // would show up as uncovered code in a page that renders once.
    react(),
    tailwindcss(),
    quickpickle(),
    serveMockServiceWorker(),
  ],
  test: {
    name: 'pages',
    passWithNoTests: true,
    globals: true,
    include: ['features/pages/**/*.feature', '**/*.browser.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.databricks/**', '**/.stryker-tmp/**'],
    setupFiles: ['./features/steps/pages.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: browserLaunchOptions() }),
      instances: [{ browser: 'chromium' }],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
