import { existsSync, readFileSync } from 'node:fs';
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

const read = (path: string): string => readFileSync(join(project.root, path), 'utf8');
const manifest = { name: 'orders', scripts: { dev: 'vite', postinstall: 'tsx tools/unpack-docs.ts' } };

function generatedProject(): void {
  project
    .write('package.json', `${JSON.stringify(manifest, null, 2)}\n`)
    .write('_docs/plan.md')
    .write('tools/unpack-docs.ts')
    .write('tools/unpack-docs.test.ts')
    .write('tools/check-triggers.ts');
}

test('removes itself and its test after renaming', () => {
  generatedProject();
  unpackDocs(project.root);
  expect(exists('tools/unpack-docs.ts')).toBe(false);
  expect(exists('tools/unpack-docs.test.ts')).toBe(false);
  expect(exists('tools/check-triggers.ts')).toBe(true);
});

test('removes the postinstall script from package.json and keeps the rest, formatted as Prettier prints it', () => {
  generatedProject();
  unpackDocs(project.root);
  const expected = { name: 'orders', scripts: { dev: 'vite' } };
  expect(read('package.json')).toBe(`${JSON.stringify(expected, null, 2)}\n`);
});

test('keeps its files and the postinstall script when docs/ already exists', () => {
  generatedProject();
  project.write('docs/plan.md');
  unpackDocs(project.root);
  expect(exists('tools/unpack-docs.ts')).toBe(true);
  expect(read('package.json')).toContain('postinstall');
});

test('keeps its files and the postinstall script inside the template', () => {
  const unrendered = `${'{'.repeat(2)}.projectName}}`;
  generatedProject();
  const templateManifest = `${JSON.stringify({ ...manifest, name: unrendered }, null, 2)}\n`;
  project.write('package.json', templateManifest);
  unpackDocs(project.root);
  expect(exists('tools/unpack-docs.ts')).toBe(true);
  expect(exists('tools/unpack-docs.test.ts')).toBe(true);
  expect(read('package.json')).toBe(templateManifest);
});
