import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** How a template variable starts. Spelled out so that the Databricks CLI doesn't treat this file as a template. */
const UNRENDERED = '{'.repeat(2);

/** True inside the template itself, where `package.json` still holds the unrendered project name. */
function isTemplateSource(root: string): boolean {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const name = typeof manifest === 'object' && manifest !== null && 'name' in manifest ? manifest.name : '';
  return typeof name === 'string' && name.startsWith(UNRENDERED);
}

/** Drops the `postinstall` script, and writes `package.json` the way Prettier prints it. */
function removePostinstall(root: string): void {
  const path = join(root, 'package.json');
  const manifest: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('scripts' in manifest)) return;
  const { scripts } = manifest;
  if (typeof scripts !== 'object' || scripts === null || !('postinstall' in scripts)) return;
  delete scripts.postinstall;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Renames `_docs/` to `docs/`, then removes this script, its test and the `postinstall` entry that runs it, and
 * returns whether it did.
 *
 * `databricks apps init` never copies a folder named `docs`, so the template ships the project's documents as
 * `_docs/`, and `postinstall` gives the folder its real name once. A generated project has no use for the mechanism
 * afterwards, so nothing of it stays behind. Where `docs/` already exists, or in the template itself, this does
 * nothing.
 */
export function unpackDocs(root: string): boolean {
  const shipped = join(root, '_docs');
  const wanted = join(root, 'docs');
  if (isTemplateSource(root) || !existsSync(shipped) || existsSync(wanted)) return false;
  renameSync(shipped, wanted);
  rmSync(join(root, 'tools', 'unpack-docs.ts'), { force: true });
  rmSync(join(root, 'tools', 'unpack-docs.test.ts'), { force: true });
  removePostinstall(root);
  return true;
}

if (import.meta.main) unpackDocs(process.cwd());
