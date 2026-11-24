import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The layers of the client, plus the two folders the starter app ships outside them. */
const KNOWN_FOLDERS = new Set(['components', 'pages', 'hooks', 'acl', 'domain', 'lib', 'design']);

/**
 * Fails for any folder directly under `client/src/` that isn't one of the known layers.
 *
 * A new top-level folder usually means a bounded context has arrived. Whether the app owns contexts,
 * sits over contexts owned elsewhere, or lives inside one decides the structure, so the folder must
 * wait for that answer instead of being invented here.
 */
export function checkClientLayout(root: string): string[] {
  const source = join(root, 'client', 'src');
  if (!existsSync(source)) return [];
  return readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !KNOWN_FOLDERS.has(entry.name))
    .map(
      (entry) =>
        `client/src/${entry.name}/ is not a known layer (${[...KNOWN_FOLDERS].join(', ')}). ` +
        'A new top-level folder means a bounded context: answer the bounded-contexts question in ' +
        'docs/open-questions.md first, then extend this check and docs/design/architecture.md to match.'
    );
}
