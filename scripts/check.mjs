// © Kerrick Long <me@kerricklong.com>
// SPDX-License-Identifier: MIT-0

// The template repository's own check: generate projects from this checkout
// with the Databricks CLI, install each from its own lockfile, and run its own
// `check` script. It needs no workspace credentials and works on any OS.
//
// Two projects are generated. The first selects no plugins and must pass as it
// is. The second selects the AppKit plugins listed in `plugins` below, where
// every plugin the template offers belongs, all at once. Some plugins
// bring a fact that one of the project's waiting checks exists to catch (a
// write route, say), so its check is expected to fail there, and only there,
// with the message the developer will see. The script makes sure each such
// failure says exactly what it should, applies the fix the message asks for,
// and then requires the project's whole check to pass.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isWindows = process.platform === 'win32';

// The plugins the second project selects, each with a made-up value for every
// resource field `apps init` asks for. Nothing contacts a workspace, so the
// values only have to be well formed.
const plugins = {
  agents: {},
  aiSearch: { 'vector-search-index.id': 'check.app.index' },
  analytics: { 'sql-warehouse.id': 'abc123' },
  design: {},
  files: { 'files.path': '/Volumes/check/app/files' },
  genie: { 'genie-space.id': 'check-space', 'genie-space.name': 'Check space' },
  jobs: { 'job.id': '42' },
  lakebase: {
    'postgres.branch': 'projects/check/branches/main',
    'postgres.database': 'projects/check/branches/main/databases/app',
  },
  serving: { 'serving-endpoint.name': 'check-endpoint' },
};

// The failures the plugins project must show, each matched line by line
// against what its script prints (pnpm's own output silenced), and the fix
// each message asks for. Any line that matches none of them is a defect.
const expectedFailures = [
  {
    why: "Lakebase's sample todo list writes, and no design document says where writes go yet",
    script: 'lint:triggers',
    lines: [
      /^server\/routes\/lakebase\/todo-routes\.ts registers a route that is not GET, but no design document records the write target\. Add a "Write target" section to a document in docs\/design\//,
    ],
    fix(projectDir) {
      appendFileSync(
        join(projectDir, 'docs', 'design', 'architecture.md'),
        '\n## Write target\n\nThe sample todo list writes to Lakebase.\n',
      );
      return ['docs/design/architecture.md'];
    },
  },
  {
    why: 'an AI Search index returns only the columns the project chooses, and none are chosen yet',
    script: 'lint:ast-grep',
    lines: [
      /^Scanning \d+ TypeScript files\.\.\.$/,
      /^Found 1 violation\(s\):$/,
      // appkit lint prints paths with the system's separator.
      /^server[/\\]server\.ts:\d+:\d+$/,
      /^ {2}ai-search-index-requires-columns: AI Search index has no `columns`; it will fail in production .* Set `columns` explicitly on each index\.$/,
      /^ {2}> aiSearch\(\)$/,
    ],
    fix(projectDir) {
      const path = join(projectDir, 'server', 'server.ts');
      const source = readFileSync(path, 'utf8');
      writeFileSync(path, source.replace('aiSearch()', "aiSearch({ indexes: { default: { columns: ['id'] } } })"));
      return ['server/server.ts'];
    },
  },
];

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

// The step now running, so a signal can stop it before the scratch folder goes.
let current = null;

// Runs a command. With `capture`, its output is collected rather than shown,
// and the promise resolves with the exit code and output whatever the code.
function run(label, command, args, { cwd, env, capture = false }) {
  console.log(`\n== ${label}\n$ ${[command, ...args].join(' ')}`);
  return new Promise((resolvePromise, reject) => {
    const stdio = capture ? ['ignore', 'pipe', 'pipe'] : 'inherit';
    // On Windows, tools installed as .cmd shims need a shell to start.
    const child = isWindows
      ? spawn([command, ...args.map(quote)].join(' '), { cwd, env, stdio, shell: true })
      : spawn(command, args, { cwd, env, stdio });
    current = child;
    let output = '';
    if (capture) {
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
    }
    child.on('error', reject);
    child.on('close', (code, signal) => {
      current = null;
      if (capture) resolvePromise({ code, output });
      else if (code === 0) resolvePromise();
      else reject(new Error(`${label} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

const scratch = mkdtempSync(join(tmpdir(), 'appkit-template-check-'));
let failed = false;

function removeScratch() {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

// A cancelled CI job sends SIGTERM, and Ctrl-C sends SIGINT. Neither runs the
// `finally` below, so stop the running step, wait for it, and clean up here.
for (const [signal, number] of [
  ['SIGINT', 2],
  ['SIGTERM', 15],
]) {
  process.once(signal, () => {
    const finish = () => {
      removeScratch();
      process.exit(128 + number);
    };
    if (current && current.exitCode === null && current.signalCode === null) {
      current.once('close', finish);
      current.kill(signal);
      setTimeout(finish, 10_000).unref();
    } else finish();
  });
}

// Generates a project into its own folder under the scratch folder, installs
// it, and checks that its documents were unpacked. Returns its folder.
async function generate(appName, initArgs) {
  const outputDir = join(scratch, appName);
  mkdirSync(outputDir);
  const projectDir = join(outputDir, appName);

  await run(
    `Generate ${appName} from this checkout`,
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
      ...initArgs,
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

  await run(`Install ${appName}`, 'pnpm', ['install', '--frozen-lockfile'], {
    cwd: projectDir,
    env: cleanEnv(),
  });
  // The CLI never copies a folder named docs, so the template ships _docs/
  // and the project's postinstall renames it, then removes itself.
  if (!existsSync(join(projectDir, 'docs', 'plan.md')) || existsSync(join(projectDir, '_docs'))) {
    throw new Error(`${appName} has no docs/ after install: _docs/ was not unpacked`);
  }
  const leftovers = ['unpack-docs.ts', 'unpack-docs.test.ts'].filter((name) =>
    existsSync(join(projectDir, 'tools', name)),
  );
  if (leftovers.length > 0) {
    throw new Error(`${appName} still has tools/${leftovers.join(', tools/')} after install`);
  }
  const { scripts = {} } = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  if ('postinstall' in scripts) {
    throw new Error(`${appName} still has a postinstall script after install`);
  }
  console.log(`\n${appName}: the project documents are in docs/, and the unpacker is gone.`);
  return projectDir;
}

// Runs an expected failure's script, and requires it to fail with exactly the
// expected lines: every line it prints matches one of them, and each of them
// matches some line.
async function expectFailure(projectDir, failure) {
  const { code, output } = await run(
    `Expect ${failure.script} to fail: ${failure.why}`,
    'pnpm',
    ['--silent', 'run', failure.script],
    { cwd: projectDir, env: cleanEnv(), capture: true },
  );
  console.log(output.trimEnd());
  const printed = output.split(/\r?\n/).filter((line) => line.trim() !== '');
  const unexpected = printed.filter((line) => !failure.lines.some((pattern) => pattern.test(line)));
  const missing = failure.lines.filter((pattern) => !printed.some((line) => pattern.test(line)));
  if (code === 0 || unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      [
        `${failure.script} did not fail the way it should (${failure.why}).`,
        `Exit code: ${code}.`,
        ...unexpected.map((line) => `Unexpected: ${line}`),
        ...missing.map((pattern) => `Missing a line matching: ${pattern}`),
      ].join('\n'),
    );
  }
}

try {
  const plain = await generate('template-check-app', []);
  await run("Run the plugin-free project's check", 'pnpm', ['run', 'check'], { cwd: plain, env: cleanEnv() });

  const sets = Object.entries(plugins).flatMap(([plugin, fields]) =>
    Object.entries(fields).flatMap(([field, value]) => ['--set', `${plugin}.${field}=${value}`]),
  );
  const withPlugins = await generate('template-check-plugins', [
    '--features',
    Object.keys(plugins).join(','),
    ...sets,
  ]);
  // A developer's second check runs over what the first one built, such as the
  // query types AppKit generates, so this project's check starts from a build.
  await run('Build the plugins project', 'pnpm', ['run', 'build'], { cwd: withPlugins, env: cleanEnv() });
  const fixed = [];
  for (const failure of expectedFailures) {
    await expectFailure(withPlugins, failure);
    fixed.push(...failure.fix(withPlugins));
  }
  await run('Format what the fixes changed', 'pnpm', ['exec', 'prettier', '--write', ...new Set(fixed)], {
    cwd: withPlugins,
    env: cleanEnv(),
  });
  await run("Run the plugins project's check, after the fixes its messages ask for", 'pnpm', ['run', 'check'], {
    cwd: withPlugins,
    env: cleanEnv(),
  });
  console.log('\nTemplate check passed.');
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
} finally {
  removeScratch();
}
process.exit(failed ? 1 : 0);
