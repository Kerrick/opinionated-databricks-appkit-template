{{if .plugins.lakebase -}}
import type { DataTable } from 'quickpickle';
import { Given, Then, When } from 'quickpickle';
import {
  addsTheTodo,
  deletesTheTodo,
  isInvitedToAddATodo,
  isToldTheTodoIsBeingAdded,
  marksTheTodo,
  opensTheTodoList,
  seesNoTodoTitled,
  seesTheProgress,
  seesTheTodos,
  theTodoListHolds,
  theTodoServiceIsDown,
} from '../../tasks/lakebase';

Given('the todo list is empty', () => {
  theTodoListHolds([]);
});

Given('the todo list holds:', (_world: unknown, table: DataTable) => {
  theTodoListHolds(table.hashes().map((row) => ({ title: row['title'] ?? '', done: row['done'] === 'yes' })));
});

Given('the todo list is empty and saving a todo takes a moment', () => {
  theTodoListHolds([], 300);
});

Given('the todo service is down', () => {
  theTodoServiceIsDown();
});

When('they open the todo list', () => opensTheTodoList());
When('they add the todo {string}', (_world: unknown, title: string) => addsTheTodo(title));
When('they mark {string} as complete', (_world: unknown, title: string) => marksTheTodo(title, 'complete'));
When('they mark {string} as incomplete', (_world: unknown, title: string) => marksTheTodo(title, 'incomplete'));
When('they delete {string}', (_world: unknown, title: string) => deletesTheTodo(title));

Then('they are invited to add a todo', () => isInvitedToAddATodo());
Then('they see the todos {string} and {string}', (_world: unknown, first: string, second: string) =>
  seesTheTodos([first, second])
);
Then('they see the todo {string}', (_world: unknown, title: string) => seesTheTodos([title]));
Then('they no longer see the todo {string}', (_world: unknown, title: string) => seesNoTodoTitled(title));
Then('the list says {string}', (_world: unknown, progress: string) => seesTheProgress(progress));
Then('they are told the todo is being added', () => isToldTheTodoIsBeingAdded());
{{- end}}
