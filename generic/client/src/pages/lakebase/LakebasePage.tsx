{{if .plugins.lakebase -}}
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@databricks/appkit-ui/react';
import { Check, X } from 'lucide-react';
import { Form, useLoaderData, useNavigation } from 'react-router';
import type { listTodos } from '../../acl/todos';

/** The todo list. The route's loader fetches the todos and its action handles the forms (see App.tsx). */
export function LakebasePage() {
  const todos = useLoaderData<Awaited<ReturnType<typeof listTodos>>>();
  const submitting = useNavigation().state === 'submitting';
  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Todo List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            A simple CRUD example powered by Databricks Lakebase (PostgreSQL).
          </p>

          <Form method="post" className="flex gap-2 mb-6">
            <input type="hidden" name="intent" value="add" />
            <Input
              name="title"
              placeholder="What needs to be done?"
              required
              disabled={submitting}
              className="flex-1"
              aria-label="New todo"
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </Button>
          </Form>

          {todos.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No todos yet. Add one above to get started.</p>
          )}

          {todos.length > 0 && (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={todo.id} />
                    <button
                      type="submit"
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        todo.completed
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30 hover:border-primary'
                      }`}
                      aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {todo.completed && <Check className="h-3 w-3" />}
                    </button>
                  </Form>

                  <span className={`flex-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {todo.title}
                  </span>

                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={todo.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Delete todo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Form>
                </div>
              ))}

              <p className="text-xs text-muted-foreground pt-2">
                {completedCount} of {todos.length} completed
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
{{- end}}
