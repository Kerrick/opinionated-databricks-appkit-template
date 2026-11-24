import { designDocRecords } from '../lib/design-docs.ts';
import { listDirectories, listFiles, readIfPresent } from '../lib/files.ts';

/** `lakebase()` or `database()` called in the server entry point. */
const REGISTRATION = /\b(lakebase|database)\s*\(/g;

/**
 * Fails from the moment Lakebase arrives (a `lakebase()` or `database()` plugin in `server/server.ts`, or a
 * `migrations` folder) until its SQL is linted as Postgres and its migrations are checked for safety.
 * The `database()` plugin also needs a design document on per-user authorization, since it has none.
 */
export function checkLakebase(root: string): string[] {
  const registered = new Set(
    [...readIfPresent(root, 'server/server.ts').matchAll(REGISTRATION)].map((match) => match[1])
  );
  const migrationFolders = listDirectories(root).filter((path) => path.split('/').at(-1) === 'migrations');
  if (registered.size === 0 && migrationFolders.length === 0) return [];

  const problems: string[] = [];
  const postgresLinted = listFiles(root).some(
    (path) =>
      path !== '.sqlfluff' &&
      path.endsWith('/.sqlfluff') &&
      readIfPresent(root, path).split("\n").some((line) => /^dialect\s*=\s*postgres$/.test(line.trim())) &&
      (path.startsWith('config/database/') || path.includes('/migrations/'))
  );
  if (!postgresLinted) {
    problems.push(
      'Lakebase is in use but its SQL is not linted as Postgres. Put a .sqlfluff with "dialect = postgres" ' +
        'in config/database/ (and in each migrations folder), and lint those folders from the lint script.'
    );
  }
  if (!/\bsquawk\b/.test(readIfPresent(root, 'package.json'))) {
    problems.push(
      'Lakebase is in use but migrations are not checked for unsafe changes. Run squawk over the migrations ' +
        'from a script that the lint script calls, and pin it in mise.toml.'
    );
  }
  if (registered.has('database') && !designDocRecords(root, 'Per-user authorization')) {
    problems.push(
      'The database() plugin runs as the app service principal and has no per-user or per-row authorization. ' +
        'Add a "Per-user authorization" section to a document in docs/design/ saying how that is handled.'
    );
  }
  return problems;
}
