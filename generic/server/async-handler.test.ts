import { Plugin, type PluginManifest, toPlugin } from '@databricks/appkit';
import { createTestApp } from '@databricks/appkit/testing';
import { describe, expect, test } from 'vitest';
import { asyncHandler } from './async-handler';

type Router = Parameters<Plugin['injectRoutes']>[0];

class FailingPlugin extends Plugin {
  static readonly manifest: PluginManifest<'failing'> = {
    name: 'failing',
    displayName: 'Failing',
    description: 'Routes that fail, to prove failures reach the error response',
    resources: { required: [], optional: [] },
  };

  override injectRoutes(router: Router) {
    router.get(
      '/rejects',
      asyncHandler(async () => {
        await Promise.resolve();
        throw new Error('rejected');
      })
    );
    router.get(
      '/works',
      asyncHandler(async (_req, res) => {
        await Promise.resolve();
        res.json({ ok: true });
      })
    );
  }
}

const failing = toPlugin(FailingPlugin);

describe('asyncHandler', () => {
  test('answers a failing async handler with an error response instead of hanging', async () => {
    const app = await createTestApp({ plugins: [failing()] });
    try {
      const response = await app.get('/api/failing/rejects');
      expect(response.status).toBe(500);
    } finally {
      await app.close();
    }
  });

  test('leaves a working handler alone', async () => {
    const app = await createTestApp({ plugins: [failing()] });
    try {
      const response = await app.get('/api/failing/works');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});
