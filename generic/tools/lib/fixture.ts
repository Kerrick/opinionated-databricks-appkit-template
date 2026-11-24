import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A throwaway project folder for tests of the repository checks. */
export class Fixture {
  readonly root = mkdtempSync(join(tmpdir(), 'check-'));

  /** Writes `content` to `path` (relative to the root), creating folders as needed. */
  write(path: string, content = ''): this {
    const absolute = join(this.root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
    return this;
  }

  /** Creates an empty folder. */
  folder(path: string): this {
    mkdirSync(join(this.root, path), { recursive: true });
    return this;
  }

  /** Deletes the folder. */
  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
