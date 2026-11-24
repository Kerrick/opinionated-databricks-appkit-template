import { join } from 'node:path';
import { listFiles, readIfPresent } from './files.ts';

/**
 * True when a Markdown file in `docs/design/` has a heading called `heading` with some text under it.
 * An empty heading is only a placeholder, so it doesn't count as a record.
 */
export function designDocRecords(root: string, heading: string): boolean {
  const headingLine = new RegExp(`^#{1,4}\\s+${heading}\\s*$`, 'i');
  return listFiles(root, join(root, 'docs', 'design'))
    .filter((path) => path.endsWith('.md'))
    .some((path) => {
      const lines = readIfPresent(root, path).split('\n');
      const start = lines.findIndex((line) => headingLine.test(line));
      if (start === -1) return false;
      const body = lines.slice(start + 1);
      const end = body.findIndex((line) => /^#{1,4}\s/.test(line));
      return (end === -1 ? body : body.slice(0, end)).some((line) => line.trim() !== '');
    });
}
