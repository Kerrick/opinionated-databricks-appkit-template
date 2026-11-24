import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { checkBoundaries } from './check-boundaries.ts';
import { Fixture } from './lib/fixture.ts';

type Result = Awaited<ReturnType<typeof checkBoundaries>>;

// Running dependency-cruiser is the slow step, so each kind of project is built and checked once, in the hook,
// and the tests read the results. The time allowed is explicit because the first run loads the TypeScript
// compiler: three runs take about a second on an idle machine and a few seconds with every core held by several
// busy loops each, so a minute is far from both and still ends a run that has hung.
const checkTimeout = 60_000;

const startingFolder = process.cwd();
const fixtures: Fixture[] = [];

/** A throwaway project with the rules and a tsconfig; `fill` adds its source files. */
async function check(fill: (project: Fixture) => void): Promise<Result> {
  const project = new Fixture();
  fixtures.push(project);
  copyFileSync(
    join(import.meta.dirname, '..', '.dependency-cruiser.mjs'),
    join(project.root, '.dependency-cruiser.mjs')
  );
  project.write('tsconfig.client.json', '{ "compilerOptions": { "module": "ESNext", "moduleResolution": "bundler" } }');
  fill(project);
  // The rules match paths relative to the project root, so the run has to start there.
  process.chdir(project.root);
  try {
    return await checkBoundaries(project.root);
  } finally {
    process.chdir(startingFolder);
  }
}

// Each breach is a file of its own, so one run over all of them reports every rule it breaks, and each test
// looks for its own file in the report.
const breaches = [
  [
    'the domain importing a hook',
    'client/src/domain/Bad.ts',
    "import '../hooks/useThing';",
    'domain-imports-nothing-above-it',
  ],
  ['a component importing a page', 'client/src/components/Bad.ts', "import '../pages/Page';", 'components-not-pages'],
  [
    'the client importing the server',
    'client/src/pages/BadServer.ts',
    "import '../../../server/entry';",
    'client-not-server',
  ],
  ['the server importing the client', 'server/bad.ts', "import '../client/src/pages/Page';", 'server-not-client'],
  [
    'code outside acl importing generated types',
    'client/src/pages/BadTypes.ts',
    "import '../../../shared/appkit-types/analytics';",
    'generated-types-only-in-acl',
  ],
  [
    'a server-rendering framework',
    'client/src/pages/BadFramework.ts',
    "import 'next';",
    'no-server-rendering-frameworks',
  ],
] as const;

let empty: Result;
let clean: Result;
let breaking: Result;
beforeAll(async () => {
  empty = await check((project) => project.folder('client/src'));
  clean = await check((project) => {
    project.write('client/src/domain/Order.ts', 'export const order = 1;');
    project.write(
      'client/src/acl/useOrder.ts',
      "import { order } from '../domain/Order';\nexport const useOrder = order;"
    );
    project.write(
      'client/src/pages/Orders.ts',
      "import { useOrder } from '../acl/useOrder';\nexport const page = useOrder;"
    );
  });
  breaking = await check((project) => {
    project.write('client/src/hooks/useThing.ts', 'export const thing = 1;');
    project.write('client/src/pages/Page.ts', 'export const page = 1;');
    project.write('server/entry.ts', 'export const entry = 1;');
    project.write('shared/appkit-types/analytics.d.ts', 'export {};');
    for (const [, path, source] of breaches) project.write(path, source);
  });
}, checkTimeout);
afterAll(() => {
  for (const project of fixtures) project.dispose();
});

describe('checkBoundaries', () => {
  test('fails when it analyses no modules, so the rules are never silently off', () => {
    expect(empty.passed).toBe(false);
    expect(empty.report).toContain('analysed no modules');
  });

  test('passes for code that respects the layers', () => {
    expect(clean.passed).toBe(true);
  });

  test('fails when any layer rule is broken', () => {
    expect(breaking.passed).toBe(false);
  });

  test.each(breaches)('reports %s', (_name, path, _source, rule) => {
    const lines = breaking.report.split('\n').filter((line) => line.includes(rule));
    expect(lines.some((line) => line.includes(path))).toBe(true);
  });
});
