import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LINTABLE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const SKIPPED = /(?:^|[\\/])(?:node_modules|dist|build|coverage|\.databricks)[\\/]/;

/** Reads the path of the edited file from the JSON an editor hook sends on standard input. */
export function editedFilePath(hookInput: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(hookInput);
    const toolInput =
      typeof parsed === 'object' && parsed !== null && 'tool_input' in parsed ? parsed.tool_input : undefined;
    const path =
      typeof toolInput === 'object' && toolInput !== null && 'file_path' in toolInput ? toolInput.file_path : undefined;
    return typeof path === 'string' ? path : undefined;
  } catch {
    return undefined;
  }
}

/** True for a script or source file oxlint can check, outside build output and installed packages. */
export function isLintable(path: string): boolean {
  return LINTABLE.test(path) && !SKIPPED.test(path);
}

/**
 * Lints the file an agent just edited, so a mistake comes back in seconds instead of at the end of the task.
 * It is a convenience for coding agents that support editor hooks; `pnpm run check` stays the gate.
 */
function main(): number {
  const path = editedFilePath(readFileSync(0, 'utf8'));
  if (path === undefined || !isLintable(path)) return 0;
  const result = spawnSync(
    process.execPath,
    [join('node_modules', 'oxlint', 'bin', 'oxlint'), '--deny-warnings', path],
    {
      encoding: 'utf8',
    }
  );
  if (result.status === 0) return 0;
  // Exit code 2 sends standard error back to the agent as feedback it has to act on.
  console.error(`${result.stdout}${result.stderr}`.trim());
  return 2;
}

if (import.meta.main) {
  process.exitCode = main();
}
