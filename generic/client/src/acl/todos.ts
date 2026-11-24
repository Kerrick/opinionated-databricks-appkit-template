{{if .plugins.lakebase -}}
import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { fetchJson, fetchOrThrow } from './fetch-or-throw';

const Todo = z.object({
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
  created_at: z.string(),
});
export type Todo = z.infer<typeof Todo>;

/** What the todo forms can ask for. Each form names its intent in a hidden field. */
const TodoForm = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('add'), title: z.string().trim().min(1) }),
  z.object({ intent: z.literal('toggle'), id: z.coerce.number() }),
  z.object({ intent: z.literal('delete'), id: z.coerce.number() }),
]);

/** Loads every todo. The router calls it as the route loader, so the request starts before the page renders. */
export function listTodos(): Promise<Todo[]> {
  return fetchJson('/api/lakebase/todos', undefined, z.array(Todo), (r) => `Failed to fetch todos: ${r.statusText}`);
}

/** Handles a todo form submitted to the route: adds, toggles or deletes one todo. */
export async function submitTodoForm({ request }: ActionFunctionArgs): Promise<null> {
  const form = TodoForm.parse(Object.fromEntries(await request.formData()));
  switch (form.intent) {
    case 'add':
      await fetchJson(
        '/api/lakebase/todos',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title }),
        },
        Todo,
        (r) => `Failed to create todo: ${r.statusText}`
      );
      break;
    case 'toggle':
      await fetchJson(
        `/api/lakebase/todos/${form.id}`,
        { method: 'PATCH' },
        Todo,
        (r) => `Failed to update todo: ${r.statusText}`
      );
      break;
    case 'delete':
      await fetchOrThrow(
        `/api/lakebase/todos/${form.id}`,
        { method: 'DELETE' },
        (r) => `Failed to delete todo: ${r.statusText}`
      );
      break;
  }
  return null;
}
{{- end}}
