{{if .plugins.lakebase -}}
import { http, HttpResponse } from 'msw/http';
import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Todo } from '@/acl/todos';
import { fake } from '../mocks/browser-network';
import { fakeTodoList } from '../mocks/todos';
import { openTheApp } from './app';

/** The titles on the list, in order, so a task can say which row it means. */
let listed: string[] = [];

export function theTodoListHolds(rows: readonly { title: string; done: boolean }[], latency = 0): void {
  listed = rows.map((row) => row.title);
  const todos: Todo[] = rows.map((row, index) => ({
    id: index + 1,
    title: row.title,
    completed: row.done,
    created_at: '2026-01-01T00:00:00Z',
  }));
  fake(...fakeTodoList(todos, { latency }));
}

export function theTodoServiceIsDown(): void {
  fake(
    http.get('*/api/lakebase/todos', () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }))
  );
}

export async function opensTheTodoList(): Promise<void> {
  await openTheApp(1280, '/lakebase');
}

export async function addsTheTodo(title: string): Promise<void> {
  await userEvent.fill(page.getByLabelText('New todo'), title);
  await userEvent.click(page.getByRole('button', { name: 'Add' }));
  listed = [...listed, title];
}

export async function marksTheTodo(title: string, state: 'complete' | 'incomplete'): Promise<void> {
  await userEvent.click(page.getByRole('button', { name: `Mark as ${state}` }).nth(listed.indexOf(title)));
}

export async function deletesTheTodo(title: string): Promise<void> {
  await userEvent.click(page.getByRole('button', { name: 'Delete todo' }).nth(listed.indexOf(title)));
  listed = listed.filter((listedTitle) => listedTitle !== title);
}

export async function seesTheTodos(titles: readonly string[]): Promise<void> {
  for (const title of titles) {
    await expect.element(page.getByText(title, { exact: true })).toBeVisible();
  }
}

export async function seesNoTodoTitled(title: string): Promise<void> {
  await expect.element(page.getByText(title, { exact: true })).not.toBeInTheDocument();
}

export async function seesTheProgress(progress: string): Promise<void> {
  await expect.element(page.getByText(progress)).toBeVisible();
}

export async function isInvitedToAddATodo(): Promise<void> {
  await expect.element(page.getByText('No todos yet. Add one above to get started.')).toBeVisible();
}

export async function isToldTheTodoIsBeingAdded(): Promise<void> {
  await expect.element(page.getByRole('button', { name: 'Adding...' })).toBeVisible();
}
{{- end}}
