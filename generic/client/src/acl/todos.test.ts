{{if .plugins.lakebase -}}
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { listTodos, submitTodoForm } from './todos';

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  const interceptedFetch = globalThis.fetch;
  // The browser resolves the addresses the app fetches against its own origin; Node needs that said.
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) =>
    interceptedFetch(new URL(input, 'http://app.test'), init)
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  vi.unstubAllGlobals();
  server.close();
});

const todo = { id: 7, title: 'Buy milk', completed: false, created_at: '2026-01-01T00:00:00Z' };
const failure = () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });

function submit(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  const request = new Request('http://app.test/lakebase', { method: 'POST', body });
  return submitTodoForm({ request, params: {}, context: undefined, url: new URL(request.url), pattern: '/lakebase' });
}

describe('listTodos', () => {
  test('returns the todos the server lists', async () => {
    server.use(http.get('http://app.test/api/lakebase/todos', () => HttpResponse.json([todo])));

    expect(await listTodos()).toEqual([todo]);
  });

  test('says what failed when the server cannot list them', async () => {
    server.use(http.get('http://app.test/api/lakebase/todos', failure));

    await expect(listTodos()).rejects.toThrow(new Error('Failed to fetch todos: Internal Server Error'));
  });
});

describe('submitTodoForm', () => {
  test('adds a todo, sending its title trimmed as JSON', async () => {
    const received = vi.fn();
    server.use(
      http.post('http://app.test/api/lakebase/todos', async ({ request }) => {
        received(request.headers.get('content-type'), await request.json());
        return HttpResponse.json(todo, { status: 201 });
      })
    );

    expect(await submit({ intent: 'add', title: '  Buy milk  ' })).toBeNull();
    expect(received).toHaveBeenCalledExactlyOnceWith('application/json', { title: 'Buy milk' });
  });

  test('says what failed when the server cannot add the todo', async () => {
    server.use(http.post('http://app.test/api/lakebase/todos', failure));

    await expect(submit({ intent: 'add', title: 'Buy milk' })).rejects.toThrow(
      new Error('Failed to create todo: Internal Server Error')
    );
  });

  test('refuses a title with nothing in it', async () => {
    await expect(submit({ intent: 'add', title: '   ' })).rejects.toThrow();
  });

  test('toggles a todo by its id', async () => {
    const received = vi.fn();
    server.use(
      http.patch('http://app.test/api/lakebase/todos/:id', ({ params }) => {
        received(params['id']);
        return HttpResponse.json({ ...todo, completed: true });
      })
    );

    expect(await submit({ intent: 'toggle', id: '7' })).toBeNull();
    expect(received).toHaveBeenCalledExactlyOnceWith('7');
  });

  test('says what failed when the server cannot toggle the todo', async () => {
    server.use(http.patch('http://app.test/api/lakebase/todos/:id', failure));

    await expect(submit({ intent: 'toggle', id: '7' })).rejects.toThrow(
      new Error('Failed to update todo: Internal Server Error')
    );
  });

  test('deletes a todo by its id', async () => {
    const received = vi.fn();
    server.use(
      http.delete('http://app.test/api/lakebase/todos/:id', ({ params }) => {
        received(params['id']);
        return new HttpResponse(null, { status: 204 });
      })
    );

    expect(await submit({ intent: 'delete', id: '7' })).toBeNull();
    expect(received).toHaveBeenCalledExactlyOnceWith('7');
  });

  test('says what failed when the server cannot delete the todo', async () => {
    server.use(http.delete('http://app.test/api/lakebase/todos/:id', failure));

    await expect(submit({ intent: 'delete', id: '7' })).rejects.toThrow(
      new Error('Failed to delete todo: Internal Server Error')
    );
  });

  test('refuses a form that asks for something else', async () => {
    await expect(submit({ intent: 'archive', id: '7' })).rejects.toThrow();
  });
});
{{- end}}
