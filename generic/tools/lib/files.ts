import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.databricks',
  '.stryker-tmp',
]);

function toPortable(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Lists every file under `directory` (default: all of `root`) as forward-slash paths relative to `root`,
 * skipping build output. A missing directory has no files.
 */
export function listFiles(root: string, directory = root): string[] {
  if (!existsSync(directory)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) found.push(...listFiles(root, absolute));
    } else {
      found.push(toPortable(relative(root, absolute)));
    }
  }
  return found;
}

/** Lists every directory under `root`, as forward-slash paths relative to it, skipping build output. */
export function listDirectories(root: string, directory = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
      const absolute = join(directory, entry.name);
      found.push(toPortable(relative(root, absolute)), ...listDirectories(root, absolute));
    }
  }
  return found;
}

/** Reads a file under `root`, or returns an empty string when it doesn't exist. */
export function readIfPresent(root: string, path: string): string {
  const absolute = join(root, path);
  return existsSync(absolute) && statSync(absolute).isFile() ? readFileSync(absolute, 'utf8') : '';
}

/** True for a test or spec file, which never counts as application code. */
export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

/** Removes block and line comments from TypeScript source, so a name that only appears in a comment doesn't count. */
export function withoutComments(source: string): string {
  let text = source;
  for (let start = text.indexOf('/*'); start !== -1; start = text.indexOf('/*')) {
    const end = text.indexOf('*/', start + 2);
    text = text.slice(0, start) + (end === -1 ? '' : text.slice(end + 2));
  }
  return text
    .split('\n')
    .map((line) => (line.includes('//') ? line.slice(0, line.indexOf('//')) : line))
    .join('\n');
}
