import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { Fixture } from './lib/fixture.ts';
import { unpackDocs } from './unpack-docs.ts';

let project: Fixture;
beforeEach(() => {
  project = new Fixture();
});
afterEach(() => {
  project.dispose();
});

const exists = (path: string): boolean => existsSync(join(project.root, path));

test('renames _docs/ to docs/ in a generated project', () => {
  project.write('package.json', '{ "name": "orders" }').write('_docs/plan.md', '# Plan');
  expect(unpackDocs(project.root)).toBe(true);
  expect(exists('docs/plan.md')).toBe(true);
  expect(exists('_docs')).toBe(false);
});

test('leaves both folders alone once docs/ exists', () => {
  project.write('package.json', '{ "name": "orders" }').write('_docs/plan.md').write('docs/plan.md');
  expect(unpackDocs(project.root)).toBe(false);
  expect(exists('_docs/plan.md')).toBe(true);
});

test('does nothing when there is no _docs/', () => {
  project.write('package.json', '{ "name": "orders" }');
  expect(unpackDocs(project.root)).toBe(false);
  expect(exists('docs')).toBe(false);
});

test('does nothing inside the template, where the project name is not rendered yet', () => {
  const unrendered = `${'{'.repeat(2)}.projectName}}`;
  project.write('package.json', JSON.stringify({ name: unrendered })).write('_docs/plan.md');
  expect(unpackDocs(project.root)).toBe(false);
  expect(exists('_docs/plan.md')).toBe(true);
});

test('still renames when package.json has no name', () => {
  project.write('package.json', '[]').write('_docs/plan.md');
  expect(unpackDocs(project.root)).toBe(true);
  expect(exists('docs/plan.md')).toBe(true);
});
