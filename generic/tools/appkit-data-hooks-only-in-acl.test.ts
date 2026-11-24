import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
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
let project: Fixture;
beforeEach(() => {
  project = new Fixture();
  cpSync(join(projectRoot, 'sgconfig.yml'), join(project.root, 'sgconfig.yml'));
  cpSync(join(projectRoot, 'rules'), join(project.root, 'rules'), { recursive: true });
});
afterEach(() => {
  project.dispose();
});

/** Scans the fixture and returns the files the rule fired in, relative to the project root. */
function filesWithFindings(): string[] {
  const result = spawnSync('ast-grep', ['scan', '--json=compact', '--filter', '^appkit-data-hooks-only-in-acl$'], {
    cwd: project.root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, PATH: [join(projectRoot, 'node_modules', '.bin'), process.env.PATH].join(delimiter) },
  });
  expect(result.error).toBeUndefined();
  const findings = JSON.parse(result.stdout || '[]') as { file: string }[];
  return findings.map((finding) => finding.file.replaceAll('\\', '/'));
}

describe.each(hooks)('%s', (hook) => {
  const source = `import { ${hook} } from '@databricks/appkit-ui/react';\n`;

  test('fires in a view', () => {
    project.write('client/src/pages/Sales.tsx', source);
    expect(filesWithFindings()).toEqual(['client/src/pages/Sales.tsx']);
  });

  test('fires in a plain TypeScript file outside acl/', () => {
    project.write('client/src/lib/sales.ts', source);
    expect(filesWithFindings()).toEqual(['client/src/lib/sales.ts']);
  });

  test('stays quiet in acl/', () => {
    project.write('client/src/acl/useSales.ts', source).write('client/src/acl/nested/useSales.tsx', source);
    expect(filesWithFindings()).toEqual([]);
  });
});
