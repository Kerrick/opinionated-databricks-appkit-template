import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';

/**
 * Preloaded into the server process that the journeys start
 * (`node --import tsx --import ./features/mocks/fake-databricks.ts ./features/mocks/journey-server.ts`).
 *
 * AppKit's server needs a workspace to sign in to when it starts. Here the
 * workspace is a fake that lives inside the server's own process and answers
 * the calls it makes to Databricks, so the server itself is the real one.
 *
 * The journeys give the app a workspace address that nothing serves. Add a
 * handler for each Databricks API a journey makes the app call. A call with no
 * handler fails, so the app can never quietly reach a real workspace.
 */
const signedInUser = { id: '1', userName: 'journeys@example.invalid', displayName: 'Journeys' };

const server = setupServer(
  // The app reports its start to Databricks; nothing is listening, and nothing needs to be.
  http.post('*/telemetry-ext', () => new HttpResponse(null, { status: 200 })),
  http.get('*/api/2.0/preview/scim/v2/Me', () =>
    // The workspace's id travels in a response header, as it does from a real workspace.
    HttpResponse.json(signedInUser, { headers: { 'x-databricks-org-id': '1234567890' } })
  )
);

server.listen({ onUnhandledFrame: 'error' });
