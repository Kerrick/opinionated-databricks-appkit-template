import { delimiter } from 'node:path';
import { expect, test } from 'vitest';
import { withBrowserLibraries } from './browser-libraries.ts';

test('puts the project libraries on the library path when it is empty', () => {
  const env = withBrowserLibraries({ HOME: '/home/dev' }, '/app/.pixi/envs/default/lib');
  expect(env).toEqual({ HOME: '/home/dev', LD_LIBRARY_PATH: '/app/.pixi/envs/default/lib' });
});

test("puts the project libraries ahead of the machine's own", () => {
  const env = withBrowserLibraries({ LD_LIBRARY_PATH: '/opt/lib' }, '/app/lib');
  expect(env['LD_LIBRARY_PATH']).toBe(`/app/lib${delimiter}/opt/lib`);
});

test('leaves out variables that are unset', () => {
  const env = withBrowserLibraries({ HOME: '/home/dev', UNSET: undefined }, '/app/lib');
  expect(Object.keys(env)).toEqual(['HOME', 'LD_LIBRARY_PATH']);
});
