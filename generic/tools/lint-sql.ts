import { spawnSync } from 'node:child_process';
import { listFiles } from './lib/files.ts';

type Command = readonly [program: string, ...args: string[]];

/**
 * Decides which SQL checks the project needs, from the SQL files it has.
 *
 * Analytics queries are linted as Databricks SQL (the root `.sqlfluff`). Lakebase SQL is Postgres, linted
 * with the dialect set in the `.sqlfluff` beside it, and its migrations are also checked by squawk for
 * changes that lock tables or break running code. A project with no SQL has nothing to check.
 */
export function planSqlChecks(root: string): Command[] {
  const sqlFiles = listFiles(root).filter((path) => path.endsWith('.sql'));
  const lintFolders = new Set<string>();
  for (const path of sqlFiles) {
    if (path.startsWith('config/queries/')) lintFolders.add('config/queries');
    else if (path.startsWith('config/database/')) lintFolders.add('config/database');
    else if (path.includes('/migrations/'))
      lintFolders.add(path.slice(0, path.indexOf('/migrations/') + '/migrations'.length));
  }
  const migrations = sqlFiles.filter((path) => path.includes('migrations/'));
  const plan: Command[] = [...lintFolders]
    .sort((a, b) => a.localeCompare(b))
    .map((folder) => ['sqlfluff', 'lint', folder] as const);
  if (migrations.length > 0) plan.push(['squawk', ...migrations]);
  return plan;
}

/** Runs one command, returning false when it fails or its program isn't installed. */
function run([program, ...args]: Command): boolean {
  const result = spawnSync(program, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not run ${program}: ${result.error.message}. Install the project's tools with mise install.`);
    return false;
  }
  return result.status === 0;
}

if (import.meta.main) {
  const results = planSqlChecks(process.cwd()).map(run);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
