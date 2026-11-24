import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Fixture } from './lib/fixture.ts';

// `ast-grep test` checks the rule's pattern on snippets but knows nothing of folders. These tests scan a
// throwaway project, so the `files` and `ignores` globs are covered too.

const hooks = [
  'useAnalyticsQuery',
  'useMetricView',
  'useChartData',
  'useAgentChat',
  'useGenieChat',
  'useServingInvoke',
  'useServingStream',
  'useAiSearchQuery',
  'useDatabaseCreate',
  'useDatabaseDelete',
  'useDatabaseList',
  'useDatabaseMutation',
  'useDatabaseQuery',
  'useDatabaseRecord',
  'useDatabaseUpdate',
];

const projectRoot = resolve(import.meta.dirname, '..');
const astGrep = join(projectRoot, 'node_modules', '.bin', 'ast-grep');

// Starting ast-grep is the one slow step, so it runs once for the whole file: every case is a file of one
// throwaway project, a single scan covers them all, and each test reads its own file's result. The time allowed
// is explicit because a process has to run here: the scan takes well under a second on an idle machine and a
// few seconds with every core held by several busy loops each, so a minute is far from both and still ends a
// scan that has hung.
const scanTimeout = 60_000;

const sourceOf = (hook: string): string => `import { ${hook} } from '@databricks/appkit-ui/react';\n`;
const viewOf = (hook: string): string => `client/src/pages/${hook}.tsx`;
const libOf = (hook: string): string => `client/src/lib/${hook}.ts`;
const aclOf = (hook: string): string[] => [`client/src/acl/${hook}.ts`, `client/src/acl/nested/${hook}.tsx`];

let project: Fixture;
let flagged: Set<string>;
beforeAll(() => {
  project = new Fixture();
  cpSync(join(projectRoot, 'sgconfig.yml'), join(project.root, 'sgconfig.yml'));
  cpSync(join(projectRoot, 'rules'), join(project.root, 'rules'), { recursive: true });
  for (const hook of hooks) {
    for (const path of [viewOf(hook), libOf(hook), ...aclOf(hook)]) project.write(path, sourceOf(hook));
  }
  flagged = new Set(scan());
}, scanTimeout);
afterAll(() => {
  project.dispose();
});

/** Scans the whole project and returns the files the rule fired in, relative to the project root. */
function scan(): string[] {
  const result = spawnSync(astGrep, ['scan', '--json=compact', '--filter', '^appkit-data-hooks-only-in-acl$'], {
    cwd: project.root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: scanTimeout - 5000,
  });
  expect(result.error).toBeUndefined();
  // A scan stopped by the timeout leaves a signal, not an exit code. A normal exit is 0 or 1, whether it found something.
  expect(result.signal).toBeNull();
  const findings = z.array(z.object({ file: z.string() })).parse(JSON.parse(result.stdout || '[]'));
  return findings.map((finding) => finding.file.replaceAll('\\', '/'));
}

describe.each(hooks)('%s', (hook) => {
  test('fires in a view', () => {
    expect(flagged.has(viewOf(hook))).toBe(true);
  });

  test('fires in a plain TypeScript file outside acl/', () => {
    expect(flagged.has(libOf(hook))).toBe(true);
  });

  test('stays quiet in acl/', () => {
    expect(aclOf(hook).filter((path) => flagged.has(path))).toEqual([]);
  });
});

test('fires in the views and the plain files and nowhere else', () => {
  const expected = hooks.flatMap((hook) => [viewOf(hook), libOf(hook)]);
  const byName = (a: string, b: string): number => a.localeCompare(b);
  expect([...flagged].toSorted(byName)).toEqual(expected.toSorted(byName));
});
