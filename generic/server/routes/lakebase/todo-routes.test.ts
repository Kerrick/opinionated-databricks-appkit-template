{{if .plugins.lakebase -}}
import { Plugin, lakebase, toPlugin, type PluginManifest } from '@databricks/appkit';
import { createTestApp } from '@databricks/appkit/testing';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { Application } from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { setupSampleLakebaseRoutes } from './todo-routes';

/**
 * Tests for the sample todo routes, run against a real Postgres: PGlite, which is Postgres compiled to
 * WebAssembly, runs in this process and serves the Postgres wire protocol on a local port. Nothing here
 * needs a service, root, or credentials.
 *
 * AppKit's own Lakebase plugin is under test too. It is pointed at that port with an explicit host, user and
 * password, so it opens an ordinary `pg` connection and never asks the workspace for a token. The routes then
 * run on the real server plugin, the way `server.ts` registers them in `onPluginsReady`.
 */

interface LakebaseExports {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
interface ServerExports {
  addExtension(extension: (app: Application) => void): void;
}

function isLakebase(value: unknown): value is LakebaseExports {
  return typeof value === 'object' && value !== null && 'query' in value && typeof value.query === 'function';
}
function isServer(value: unknown): value is ServerExports {
  return (
    typeof value === 'object' && value !== null && 'addExtension' in value && typeof value.addExtension === 'function'
  );
}

/** What a test may change about how the routes are set up. */
interface Setup {
  /** Called with the database exports before the routes use them, so a test can make one fail. */
  wrap?: (lakebaseExports: LakebaseExports) => LakebaseExports;
}
let setup: Setup = {};

/**
 * Stands in for `onPluginsReady`, which the test kit's boot has no hook for: once every plugin is set up and
 * before the server starts listening, it hands the routes the database and the server, as `server.ts` does.
 */
class RoutesUnderTest extends Plugin {
  static readonly manifest: PluginManifest<'routesUnderTest'> = {
    name: 'routesUnderTest',
    displayName: 'Routes under test',
    description: 'Registers the sample Lakebase routes the way server.ts does',
    resources: { required: [], optional: [] },
  };

  override setup() {
    const context = this.context;
    if (context === undefined) throw new Error('The test plugin was set up without a context');
    context.onLifecycle('setup:complete', () => {
      const plugins = context.getPlugins();
      const database = plugins.get('lakebase');
      const server = plugins.get('server');
      if (!isLakebase(database) || !isServer(server)) throw new Error('The app has no Lakebase or server plugin');
      return setupSampleLakebaseRoutes({
        lakebase: setup.wrap?.(database) ?? database,
        server: { extend: (extension) => server.addExtension(extension) },
      });
    });
    return Promise.resolve();
  }
}

let database: PGlite;
let wire: PGLiteSocketServer;
let port: number;
let app: Awaited<ReturnType<typeof startApp>> | undefined;

function startApp() {
  return createTestApp({
    plugins: [
      lakebase({
        pool: { host: '127.0.0.1', port, user: 'tester', password: 'unused', database: 'postgres', sslMode: 'disable' },
      }),
      toPlugin(RoutesUnderTest)(),
    ],
    env: { LAKEBASE_ENDPOINT: 'projects/p/branches/b/endpoints/e', PGHOST: '127.0.0.1', PGDATABASE: 'postgres' },
  });
}

async function boot() {
  app = await startApp();
}

async function rows(sql: string) {
  return (await database.query<Record<string, unknown>>(sql)).rows;
}

// Starting PGlite compiles and boots a whole Postgres, once for the file, and a test's reset drops a schema from
// it. Both have to run for real, so their limits are stated rather than left at Vitest's 10 seconds, which the
// start overran with 8 busy loops per core.
const startLimit = 120_000;
const resetLimit = 30_000;

beforeAll(async () => {
  database = await PGlite.create();
  wire = new PGLiteSocketServer({ db: database, port: 0, maxConnections: 10 });
  await wire.start();
  port = Number(wire.getServerConn().split(':').at(-1));
}, startLimit);

afterAll(async () => {
  await wire.stop();
  await database.close();
});

beforeEach(async () => {
  setup = {};
  await database.exec('DROP SCHEMA IF EXISTS app CASCADE');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
}, resetLimit);

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
});

describe('setting up the sample table', () => {
  test('creates the schema and table when the table is missing', async () => {
    await boot();

    expect(
      await rows(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' ORDER BY ordinal_position`
      )
    ).toEqual([
      { column_name: 'id' },
      { column_name: 'title' },
      { column_name: 'completed' },
      { column_name: 'created_at' },
    ]);
    expect(console.log).toHaveBeenCalledWith('[lakebase] Created schema and table app.todos');
  });

  test('leaves a table that exists, and its rows, alone', async () => {
    await database.exec(`
      CREATE SCHEMA app;
      CREATE TABLE app.todos (id SERIAL PRIMARY KEY, title TEXT NOT NULL, completed BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO app.todos (title) VALUES ('already here');
    `);
    await boot();

    expect(console.log).toHaveBeenCalledWith('[lakebase] Table app.todos already exists, skipping setup');
    expect(console.log).not.toHaveBeenCalledWith('[lakebase] Created schema and table app.todos');
    const response = await app?.get('/api/lakebase/todos');
    expect(await response?.json()).toEqual([expect.objectContaining({ title: 'already here' })]);
  });

  test.each([
    ['an error', new Error('permission denied for database'), 'permission denied for database'],
    ['something that is not an error', 'connection refused', 'connection refused'],
  ])('still registers the routes when setup fails with %s', async (_kind, failure, message) => {
    setup = {
      wrap: () => ({ query: vi.fn().mockRejectedValue(failure) }),
    };
    await boot();

    expect(console.warn).toHaveBeenCalledWith('[lakebase] Database setup failed:', message);
    expect(console.warn).toHaveBeenCalledWith('[lakebase] Routes will be registered but may return errors');
    expect(console.warn).toHaveBeenCalledWith(
      '[lakebase] See https://developers.databricks.com/docs/appkit/v0/plugins/lakebase#database-permissions for troubleshooting'
    );
    expect((await app?.get('/api/lakebase/todos'))?.status).toBe(500);
  });
});

describe('listing todos', () => {
  test('answers an empty list when there are none', async () => {
    await boot();

    const response = await app?.get('/api/lakebase/todos');

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual([]);
  });

  test('lists the newest todo first, with every column', async () => {
    await boot();
    await database.exec(`
      INSERT INTO app.todos (title, completed, created_at) VALUES
        ('oldest', false, '2026-01-01T00:00:00Z'),
        ('newest', true, '2026-03-01T00:00:00Z'),
        ('middle', false, '2026-02-01T00:00:00Z');
    `);

    const response = await app?.get('/api/lakebase/todos');

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual([
      { id: 2, title: 'newest', completed: true, created_at: '2026-03-01T00:00:00.000Z' },
      { id: 3, title: 'middle', completed: false, created_at: '2026-02-01T00:00:00.000Z' },
      { id: 1, title: 'oldest', completed: false, created_at: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  test('answers 500 without the error when the query fails', async () => {
    await boot();
    await database.exec('DROP TABLE app.todos');

    const response = await app?.get('/api/lakebase/todos');

    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: 'Failed to list todos' });
    expect(console.error).toHaveBeenCalledWith('Failed to list todos:', expect.objectContaining({ code: '42P01' }));
  });
});

describe('creating a todo', () => {
  test('stores the trimmed title as not completed and answers 201 with the new row', async () => {
    await boot();

    const response = await app?.post('/api/lakebase/todos', { body: { title: '  buy milk  ' } });

    expect(response?.status).toBe(201);
    const created = await response?.json();
    expect(created).toMatchObject({ id: 1, title: 'buy milk', completed: false });
    expect(created).toHaveProperty('created_at', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(await rows('SELECT title, completed FROM app.todos')).toEqual([{ title: 'buy milk', completed: false }]);
  });

  test.each([
    ['no body', undefined],
    ['no title', {}],
    ['an empty title', { title: '' }],
    ['a title that is not text', { title: 7 }],
  ])('answers 400 and stores nothing for %s', async (_kind, body) => {
    await boot();

    const response = await app?.post('/api/lakebase/todos', { body });

    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: 'title is required' });
    expect(await rows('SELECT id FROM app.todos')).toEqual([]);
  });

  test('stores a title as text, so SQL in it does nothing', async () => {
    await boot();

    const response = await app?.post('/api/lakebase/todos', { body: { title: `x'); DROP TABLE app.todos; --` } });

    expect(response?.status).toBe(201);
    expect(await rows('SELECT title FROM app.todos')).toEqual([{ title: `x'); DROP TABLE app.todos; --` }]);
  });

  test('answers 500 without the error when the insert fails', async () => {
    await boot();
    await database.exec('DROP TABLE app.todos');

    const response = await app?.post('/api/lakebase/todos', { body: { title: 'buy milk' } });

    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: 'Failed to create todo' });
    expect(console.error).toHaveBeenCalledWith('Failed to create todo:', expect.objectContaining({ code: '42P01' }));
  });
});

describe.each([
  { verb: 'patch', action: 'update' },
  { verb: 'delete', action: 'delete' },
] as const)('$verb /api/lakebase/todos/:id', ({ verb, action }) => {
  test.each(['abc', '1.5', '1e3x'])('answers 400 for the id %s and touches nothing', async (id) => {
    await boot();
    await database.exec(`INSERT INTO app.todos (title) VALUES ('keep')`);

    const response = await app?.[verb](`/api/lakebase/todos/${id}`);

    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: 'Invalid id' });
    expect(await rows('SELECT title, completed FROM app.todos')).toEqual([{ title: 'keep', completed: false }]);
  });

  test('answers 404 when no todo has the id', async () => {
    await boot();

    const response = await app?.[verb]('/api/lakebase/todos/99');

    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ error: 'Todo not found' });
  });

  test('answers 500 without the error when the query fails', async () => {
    await boot();
    await database.exec('DROP TABLE app.todos');

    const response = await app?.[verb]('/api/lakebase/todos/1');

    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: `Failed to ${action} todo` });
    expect(console.error).toHaveBeenCalledWith(`Failed to ${action} todo:`, expect.objectContaining({ code: '42P01' }));
  });
});

describe('toggling a todo', () => {
  test('flips completed each time and answers with the updated row', async () => {
    await boot();
    await database.exec(`INSERT INTO app.todos (title) VALUES ('first'), ('second')`);

    const done = await app?.patch('/api/lakebase/todos/2');
    expect(done?.status).toBe(200);
    expect(await done?.json()).toEqual(expect.objectContaining({ id: 2, title: 'second', completed: true }));

    const undone = await app?.patch('/api/lakebase/todos/2');
    expect(await undone?.json()).toEqual(expect.objectContaining({ id: 2, completed: false }));

    expect(await rows('SELECT id, completed FROM app.todos ORDER BY id')).toEqual([
      { id: 1, completed: false },
      { id: 2, completed: false },
    ]);
  });
});

describe('deleting a todo', () => {
  test('removes only that todo and answers 204 with no body', async () => {
    await boot();
    await database.exec(`INSERT INTO app.todos (title) VALUES ('first'), ('second')`);

    const response = await app?.delete('/api/lakebase/todos/1');

    expect(response?.status).toBe(204);
    expect(await response?.text()).toBe('');
    expect(await rows('SELECT title FROM app.todos')).toEqual([{ title: 'second' }]);
  });
});
{{- end}}
