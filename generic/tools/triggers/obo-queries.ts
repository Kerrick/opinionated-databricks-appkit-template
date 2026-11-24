import { listFiles, readIfPresent } from '../lib/files.ts';

/** `- sql` as an item of the `user_api_scopes` list in databricks.yml. */
function declaresSqlScope(bundle: string): boolean {
  const lines = bundle.split('\n');
  const start = lines.findIndex((line) => /^\s*user_api_scopes:\s*$/.test(line));
  if (start === -1) return false;
  const indent = (lines[start]?.length ?? 0) - (lines[start]?.trimStart().length ?? 0);
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent <= indent && !line.trimStart().startsWith('- ')) return false;
    if (/^\s*-\s*['"]?sql['"]?\s*$/.test(line)) return true;
  }
  return false;
}

/**
 * Fails when a `*.obo.sql` query exists but databricks.yml doesn't grant the app the `sql` user scope.
 * Such a query runs as the signed-in user, which the platform only allows with that scope.
 */
export function checkOboQueries(root: string): string[] {
  const queries = listFiles(root).filter((path) => /^config\/queries\/.*\.obo\.sql$/.test(path));
  if (queries.length === 0 || declaresSqlScope(readIfPresent(root, 'databricks.yml'))) return [];
  return queries.map(
    (path) =>
      `${path} runs as the signed-in user, but databricks.yml does not list "sql" under user_api_scopes. ` +
      'Add it, and turn on user authorization for the workspace.'
  );
}
