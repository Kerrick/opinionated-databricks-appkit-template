import type { RequestHandler } from 'msw';
import { http, HttpResponse } from 'msw/http';

/**
 * The fakes for everything the browser asks the app's own server for under
 * `/api/`, shared by the page-level tests and the journeys.
 *
 * Add a handler here (or `network.use(...)` one in a single scenario) for each
 * endpoint a scenario relies on. A request with no fake gets a 501 and is
 * recorded, and the test fails when it finishes: an unfaked call never passes
 * silently.
 */
export interface Fakes {
  readonly handlers: readonly RequestHandler[];
  /** `METHOD /path` of every `/api/` request that had no fake. */
  readonly unfaked: string[];
}

export function createFakes(): Fakes {
  const unfaked: string[] = [];
  const refuseUnfaked = http.all('*/api/*', ({ request }) => {
    unfaked.push(`${request.method} ${new URL(request.url).pathname}`);
    return HttpResponse.json({ error: 'No fake exists for this request' }, { status: 501 });
  });
  return { handlers: [refuseUnfaked], unfaked };
}
