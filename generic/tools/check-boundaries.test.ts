import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { checkBoundaries } from './check-boundaries.ts';
import { Fixture } from './lib/fixture.ts';

const startingFolder = process.cwd();
let project: Fixture;
beforeEach(() => {
  project = new Fixture();
  copyFileSync(
    join(import.meta.dirname, '..', '.dependency-cruiser.mjs'),
    join(project.root, '.dependency-cruiser.mjs')
  );
  project.write('tsconfig.client.json', '{ "compilerOptions": { "module": "ESNext", "moduleResolution": "bundler" } }');
  // The rules match paths relative to the project root, so the run has to start there.
  process.chdir(project.root);
});
afterEach(() => {
  process.chdir(startingFolder);
  project.dispose();
});

describe('checkBoundaries', () => {
  test('fails when it analyses no modules, so the rules are never silently off', async () => {
    project.folder('client/src');
    const { passed, report } = await checkBoundaries(project.root);
    expect(passed).toBe(false);
    expect(report).toContain('analysed no modules');
  });

  test('passes for code that respects the layers', async () => {
    project.write('client/src/domain/Order.ts', 'export const order = 1;');
    project.write(
      'client/src/acl/useOrder.ts',
      "import { order } from '../domain/Order';\nexport const useOrder = order;"
    );
    project.write(
      'client/src/pages/Orders.ts',
      "import { useOrder } from '../acl/useOrder';\nexport const page = useOrder;"
    );
    const { passed } = await checkBoundaries(project.root);
    expect(passed).toBe(true);
  });

  test.each([
    [
      'the domain importing a hook',
      'client/src/domain/Bad.ts',
      "import '../hooks/useThing';",
      'domain-imports-nothing-above-it',
    ],
    ['a component importing a page', 'client/src/components/Bad.ts', "import '../pages/Page';", 'components-not-pages'],
    [
      'the client importing the server',
      'client/src/pages/Bad.ts',
      "import '../../../server/entry';",
      'client-not-server',
    ],
    ['the server importing the client', 'server/bad.ts', "import '../client/src/pages/Page';", 'server-not-client'],
    [
      'code outside acl importing generated types',
      'client/src/pages/Bad.ts',
      "import '../../../shared/appkit-types/analytics';",
      'generated-types-only-in-acl',
    ],
    ['a server-rendering framework', 'client/src/pages/Bad.ts', "import 'next';", 'no-server-rendering-frameworks'],
  ])('fails for %s', async (_name, path, source, rule) => {
    project.write('client/src/hooks/useThing.ts', 'export const thing = 1;');
    project.write('client/src/pages/Page.ts', 'export const page = 1;');
    project.write('server/entry.ts', 'export const entry = 1;');
    project.write('shared/appkit-types/analytics.d.ts', 'export {};');
    project.write(path, source);
    const { passed, report } = await checkBoundaries(project.root);
    expect(passed).toBe(false);
    expect(report).toContain(rule);
  });
});
