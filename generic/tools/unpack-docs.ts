import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/** How a template variable starts. Spelled out so that the Databricks CLI doesn't treat this file as a template. */
const UNRENDERED = '{'.repeat(2);

/** True inside the template itself, where `package.json` still holds the unrendered project name. */
function isTemplateSource(root: string): boolean {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const name = typeof manifest === 'object' && manifest !== null && 'name' in manifest ? manifest.name : '';
  return typeof name === 'string' && name.startsWith(UNRENDERED);
}

/**
 * Renames `_docs/` to `docs/`, and returns whether it did.
 *
 * `databricks apps init` never copies a folder named `docs`, so the template ships the project's documents as
 * `_docs/`, and `postinstall` gives the folder its real name. Once `docs/` exists this does nothing, so every later
 * install, including the one each deploy runs, leaves the tree alone.
 */
export function unpackDocs(root: string): boolean {
  const shipped = join(root, '_docs');
  const wanted = join(root, 'docs');
  if (isTemplateSource(root) || !existsSync(shipped) || existsSync(wanted)) return false;
  renameSync(shipped, wanted);
  return true;
}

if (import.meta.main) unpackDocs(process.cwd());
