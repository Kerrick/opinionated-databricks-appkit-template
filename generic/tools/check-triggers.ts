import { checkClientLayout } from './triggers/layout.ts';
import { checkLakebase } from './triggers/lakebase.ts';
import { checkOboQueries } from './triggers/obo-queries.ts';
import { checkWriteRoutes } from './triggers/write-routes.ts';

/** Runs every check that stays quiet until the project learns something (a context, a write path, Lakebase). */
export function checkTriggers(root: string): string[] {
  return [checkClientLayout, checkWriteRoutes, checkLakebase, checkOboQueries].flatMap((check) => check(root));
}

if (import.meta.main) {
  const problems = checkTriggers(process.cwd());
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
