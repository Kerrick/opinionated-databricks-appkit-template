// © Kerrick Long <me@kerricklong.com>
// SPDX-License-Identifier: MIT-0

// The template repository's own check: generate a project from this checkout
// with the Databricks CLI, install it from its own lockfile, and run its own
// `check` script. It needs no workspace credentials and works on any OS.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appName = 'template-check-app';
const isWindows = process.platform === 'win32';

// `apps init` refuses to start without a configured auth, even for a local
// template. A syntactically valid fake host and token get it past that without
// any network contact, and a config file that doesn't exist keeps a real
// profile from being read. Only the init step gets them.
function cleanEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^DATABRICKS_/i.test(key) || /^npm_/i.test(key)) continue;
    env[key] = value;
  }
  return env;
}

function quote(arg) {
  return /[\s"&|<>^()%!]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

function run(label, command, args, { cwd, env }) {
  console.log(`\n== ${label}\n$ ${[command, ...args].join(' ')}`);
  return new Promise((resolvePromise, reject) => {
    // On Windows, tools installed as .cmd shims need a shell to start.
    const child = isWindows
      ? spawn([command, ...args.map(quote)].join(' '), { cwd, env, stdio: 'inherit', shell: true })
      : spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${label} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

const scratch = mkdtempSync(join(tmpdir(), 'appkit-template-check-'));
let failed = false;
try {
  const outputDir = join(scratch, 'out');
  mkdirSync(outputDir);
  const projectDir = join(outputDir, appName);

  await run(
    'Generate a project from this checkout',
    'databricks',
    [
      'apps',
      'init',
      '--template',
      repoRoot,
      '--name',
      appName,
      '--output-dir',
      outputDir,
      '--skip-install',
      '--run',
      'none',
      '--auto-approve',
    ],
    {
      cwd: scratch,
      env: {
        ...cleanEnv(),
        DATABRICKS_HOST: 'https://workspace.invalid',
        DATABRICKS_TOKEN: 'not-a-real-token',
        DATABRICKS_CONFIG_FILE: join(scratch, 'no-such-databrickscfg'),
      },
    },
  );

  const projectEnv = cleanEnv();
  await run('Install the generated project', 'pnpm', ['install', '--frozen-lockfile'], {
    cwd: projectDir,
    env: projectEnv,
  });
  await run('Run the generated project\'s own check', 'pnpm', ['run', 'check'], {
    cwd: projectDir,
    env: projectEnv,
  });
  console.log('\nTemplate check passed.');
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
} finally {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
process.exit(failed ? 1 : 0);
