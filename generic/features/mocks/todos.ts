{{if .plugins.lakebase -}}
import { delay, type RequestHandler } from 'msw';
import { http, HttpResponse } from 'msw/http';
import type { Todo } from '@/acl/todos';

/**
 * Fakes the todo routes the Lakebase plugin's sample serves, over a list that behaves like the real one:
 * adding, toggling and deleting change what the next listing returns. `latency` holds each write back, so a
 * scenario can look at the page while a change is still on its way.
 */
export function fakeTodoList(initial: readonly Todo[], options: { latency?: number } = {}): RequestHandler[] {
  let todos = [...initial];
  let nextId = Math.max(0, ...todos.map((todo) => todo.id)) + 1;
  const hold = () => delay(options.latency ?? 0);

  return [
    http.get('*/api/lakebase/todos', () => HttpResponse.json(todos)),
    http.post('*/api/lakebase/todos', async ({ request }) => {
      await hold();
      const body: unknown = await request.json();
      const title = typeof body === 'object' && body !== null && 'title' in body ? String(body.title) : '';
      const todo: Todo = { id: nextId++, title, completed: false, created_at: '2026-01-01T00:00:00Z' };
      todos = [...todos, todo];
      return HttpResponse.json(todo, { status: 201 });
    }),
    http.patch<{ id: string }>('*/api/lakebase/todos/:id', async ({ params }) => {
      await hold();
      const target = todos.find((todo) => todo.id === Number(params.id));
      if (!target) return new HttpResponse(null, { status: 404 });
      const toggled = { ...target, completed: !target.completed };
      todos = todos.map((todo) => (todo.id === toggled.id ? toggled : todo));
      return HttpResponse.json(toggled);
    }),
    http.delete<{ id: string }>('*/api/lakebase/todos/:id', async ({ params }) => {
      await hold();
      todos = todos.filter((todo) => todo.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
{{- end}}
