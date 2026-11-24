import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { z } from 'zod';

// AppKit's charts register their chart types on the copy of ECharts they import. The app's own registration of
// ECharts' accessibility support reaches them only when the app imports that very copy, so the two must agree.
// See docs/design/architecture.md.

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const fromProject = createRequire(`${projectRoot}package.json`);
const appkitUiManifest = fromProject.resolve('@databricks/appkit-ui/package.json');
const fromAppkitUi = createRequire(appkitUiManifest);

const Manifest = z.object({ dependencies: z.record(z.string(), z.string()).optional() });

function manifest(path: string) {
  return Manifest.parse(JSON.parse(readFileSync(path, 'utf8')));
}

test('the app pins echarts to the exact version AppKit depends on', () => {
  const pinned = manifest(`${projectRoot}package.json`).dependencies?.['echarts'];
  const wanted = manifest(appkitUiManifest).dependencies?.['echarts'];
  expect(wanted).toMatch(/^\d+\.\d+\.\d+$/);
  expect(pinned).toBe(wanted);
});

test('the app and AppKit load the same copy of ECharts', () => {
  // pnpm gives a package only what it declares. Resolving from the project would find AppKit's copy through the
  // folder pnpm's own scripts add to the search path, so look at what the project itself installed.
  const ours = realpathSync(`${projectRoot}node_modules/echarts`);
  const theirs = dirname(realpathSync(fromAppkitUi.resolve('echarts/core')));
  expect(ours).toBe(theirs);
});
