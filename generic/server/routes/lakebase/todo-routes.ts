{{if .plugins.lakebase -}}
// For per-user connections (OBO) with Row-Level Security, see:
// https://developers.databricks.com/docs/appkit/v0/plugins/lakebase#on-behalf-of-obo--per-user-connections

import { z } from 'zod';
import type { Application, Response } from 'express';
import { asyncHandler } from '../../async-handler';

interface AppKitWithLakebase {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

const TABLE_EXISTS_SQL = `
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'app' AND table_name = 'todos'
`;

const SETUP_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS app`;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app.todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CreateTodoBody = z.object({ title: z.string().min(1) });
const TodoParams = z.object({ id: z.coerce.number().int() });

const TOGGLE_TODO_SQL =
  'UPDATE app.todos SET completed = NOT completed WHERE id = $1 RETURNING id, title, completed, created_at';
const DELETE_TODO_SQL = 'DELETE FROM app.todos WHERE id = $1 RETURNING id';

/** Runs a query for one todo and sends its row, answering 404 when no todo has that id and 500 when the query fails. */
async function withTodoRow(
  appkit: AppKitWithLakebase,
  res: Response,
  sql: string,
  id: number,
  action: string,
  send: (row: Record<string, unknown>) => void
): Promise<void> {
  try {
    const row = (await appkit.lakebase.query(sql, [id])).rows[0];
    if (row === undefined) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    send(row);
  } catch (err) {
    console.error(`Failed to ${action} todo:`, err);
    res.status(500).json({ error: `Failed to ${action} todo` });
  }
}

/** Creates the sample todo table if it is missing and registers its routes. */
export async function setupSampleLakebaseRoutes(appkit: AppKitWithLakebase) {
  try {
    const { rows } = await appkit.lakebase.query(TABLE_EXISTS_SQL);
    if (rows.length > 0) {
      console.log('[lakebase] Table app.todos already exists, skipping setup');
    } else {
      await appkit.lakebase.query(SETUP_SCHEMA_SQL);
      await appkit.lakebase.query(CREATE_TABLE_SQL);
      console.log('[lakebase] Created schema and table app.todos');
    }
  } catch (err) {
    console.warn('[lakebase] Database setup failed:', err instanceof Error ? err.message : String(err));
    console.warn('[lakebase] Routes will be registered but may return errors');
    console.warn(
      '[lakebase] See https://developers.databricks.com/docs/appkit/v0/plugins/lakebase#database-permissions for troubleshooting'
    );
  }

  appkit.server.extend((app) => {
    app.get(
      '/api/lakebase/todos',
      asyncHandler(async (_req, res) => {
        try {
          const result = await appkit.lakebase.query(
            'SELECT id, title, completed, created_at FROM app.todos ORDER BY created_at DESC'
          );
          res.json(result.rows);
        } catch (err) {
          console.error('Failed to list todos:', err);
          res.status(500).json({ error: 'Failed to list todos' });
        }
      })
    );

    app.post(
      '/api/lakebase/todos',
      asyncHandler(async (req, res) => {
        try {
          const parsed = CreateTodoBody.safeParse(req.body);
          if (!parsed.success) {
            res.status(400).json({ error: 'title is required' });
            return;
          }
          const result = await appkit.lakebase.query(
            'INSERT INTO app.todos (title) VALUES ($1) RETURNING id, title, completed, created_at',
            [parsed.data.title.trim()]
          );
          res.status(201).json(result.rows[0]);
        } catch (err) {
          console.error('Failed to create todo:', err);
          res.status(500).json({ error: 'Failed to create todo' });
        }
      })
    );

    app.patch(
      '/api/lakebase/todos/:id',
      asyncHandler(async (req, res) => {
        const params = TodoParams.safeParse(req.params);
        if (!params.success) {
          res.status(400).json({ error: 'Invalid id' });
          return;
        }
        await withTodoRow(appkit, res, TOGGLE_TODO_SQL, params.data.id, 'update', (row) => res.json(row));
      })
    );

    app.delete(
      '/api/lakebase/todos/:id',
      asyncHandler(async (req, res) => {
        const params = TodoParams.safeParse(req.params);
        if (!params.success) {
          res.status(400).json({ error: 'Invalid id' });
          return;
        }
        await withTodoRow(appkit, res, DELETE_TODO_SQL, params.data.id, 'delete', () => res.status(204).send());
      })
    );
  });
}
{{- end}}
