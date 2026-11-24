import { designDocRecords } from '../lib/design-docs.ts';
import { isTestFile, listFiles, readIfPresent, withoutComments } from '../lib/files.ts';

/** A route registered with `app.post(...)`, `router.put(...)` and the like. */
const VERB_CALL = /\.(post|put|patch|delete)\s*\(/;
/** A route described as data: `{ method: 'post', ... }`. */
const VERB_PROPERTY = /\bmethod\s*:\s*['"`](post|put|patch|delete)['"`]/i;

/**
 * Fails when custom server code answers anything but GET and no design document records the write target.
 *
 * Where writes go (Lakebase, Delta through the warehouse, or an existing system) changes everything
 * downstream, so the first write route waits until that choice is written down.
 */
export function checkWriteRoutes(root: string): string[] {
  const offenders = listFiles(root)
    .filter((path) => /^server\/.*\.[cm]?tsx?$/.test(path) && !isTestFile(path))
    .filter((path) => {
      const source = withoutComments(readIfPresent(root, path));
      return VERB_CALL.test(source) || VERB_PROPERTY.test(source);
    });
  if (offenders.length === 0 || designDocRecords(root, 'Write target')) return [];
  return offenders.map(
    (path) =>
      `${path} registers a route that is not GET, but no design document records the write target. ` +
      'Add a "Write target" section to a document in docs/design/ (architecture.md is the usual home) ' +
      'saying where writes go and why, then rerun the check.'
  );
}
