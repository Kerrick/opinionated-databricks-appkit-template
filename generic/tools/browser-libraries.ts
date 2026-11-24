import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// On Linux, Chromium links against shared libraries (NSS, GLib, X11 and a few
// more) that a machine may not have, and a system package manager needs root
// to add them. The project brings its own copies instead: pixi installs the
// conda-forge packages that `pixi.toml` and `pixi.lock` pin into `.pixi/`, and
// only the browser is pointed at them, through its launch environment. macOS
// and Windows browsers carry everything they need, so nothing changes there.

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

/** Where pixi puts the libraries. */
export const browserLibraryFolder = join(projectRoot, '.pixi', 'envs', 'default', 'lib');

/** The environment to start the browser with: `env` with `folder` first on the library path. */
export function withBrowserLibraries(env: NodeJS.ProcessEnv, folder: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined) result[key] = value;
  const inherited = env['LD_LIBRARY_PATH'];
  result['LD_LIBRARY_PATH'] = inherited ? `${folder}${delimiter}${inherited}` : folder;
  return result;
}

/**
 * Launch options for Playwright's Chromium, for `launchOptions` in a Playwright or Vitest config. On Linux they give
 * the browser the project's libraries; elsewhere they are empty.
 */
export function browserLaunchOptions(): { env?: Record<string, string> } {
  return process.platform === 'linux' ? { env: withBrowserLibraries(process.env, browserLibraryFolder) } : {};
}

function run(program: string, args: readonly string[]): boolean {
  const result = spawnSync(program, args, { cwd: projectRoot, stdio: 'inherit' });
  if (result.error) console.error(`Could not run ${program}: ${result.error.message}`);
  return result.status === 0;
}

/** What `program` prints, trimmed, or an empty string when it fails. */
function output(program: string, args: readonly string[]): string {
  const result = spawnSync(program, args, { cwd: projectRoot, encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  console.error(`${program} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr.trim()}`);
  return '';
}

/**
 * Installs the browser's libraries on Linux, exactly as `pixi.lock` pins them, and returns whether that worked.
 * pixi itself comes from mise, at the version `mise.toml` pins. Needs no root. Does nothing on other systems.
 */
export function installBrowserLibraries(): boolean {
  if (process.platform !== 'linux') return true;
  if (!run('mise', ['install', 'pixi'])) {
    console.error("Install the project's tools with mise (https://mise.jdx.dev), then try again.");
    return false;
  }
  const pixi = output('mise', ['which', 'pixi']);
  if (pixi === '') return false;
  return run(pixi, ['install', '--locked', '--manifest-path', join(projectRoot, 'pixi.toml')]);
}
