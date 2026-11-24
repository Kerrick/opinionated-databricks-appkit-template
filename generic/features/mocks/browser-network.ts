{{if .plugins.lakebase}}import type { RequestHandler } from 'msw';
{{end}}import { setupWorker } from 'msw/browser';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { createFakes } from './fakes';

/**
 * Starts the fakes in the page-level tests' browser and checks, after each
 * test, that nothing reached the network unfaked.
 */
const fakes = createFakes();
const worker = setupWorker(...fakes.handlers);
{{if .plugins.lakebase}}
/** Adds fakes for the rest of the scenario that is running. */
export function fake(...handlers: RequestHandler[]): void {
  worker.use(...handlers);
}
{{end}}
beforeAll(async () => {
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
});

afterEach(() => {
  const unfaked = fakes.unfaked.splice(0);
  worker.resetHandlers();
  expect(unfaked, 'requests to /api/ that no scenario faked').toEqual([]);
});

afterAll(() => {
  void worker.stop();
});
