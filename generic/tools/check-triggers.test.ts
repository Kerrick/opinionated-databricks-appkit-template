import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { checkTriggers } from './check-triggers.ts';
import { Fixture } from './lib/fixture.ts';

let project: Fixture;
beforeEach(() => {
  project = new Fixture();
});
afterEach(() => {
  project.dispose();
});

describe('a project that has learned nothing yet', () => {
  test('passes with only the known layers', () => {
    project.folder('client/src/components').folder('client/src/acl').folder('client/src/domain');
    project.write('server/server.ts', 'createApp({ plugins: [server()] });');
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('passes in an empty folder', () => {
    expect(checkTriggers(project.root)).toEqual([]);
  });
});

describe('client layout', () => {
  test('fails for an unknown folder and points at the bounded-contexts question', () => {
    project.folder('client/src/billing');
    const [problem, ...rest] = checkTriggers(project.root);
    expect(rest).toEqual([]);
    expect(problem).toContain('client/src/billing/');
    expect(problem).toContain('bounded-contexts question in docs/open-questions.md');
  });

  test('ignores files at the top of client/src', () => {
    project.write('client/src/App.tsx', 'export {};');
    expect(checkTriggers(project.root)).toEqual([]);
  });
});

describe('write routes', () => {
  const route = "app.post('/api/orders', handler);";

  test.each([
    ["app.post('/x', h)", 'a verb call'],
    ["router.delete ('/x', h)", 'a spaced verb call'],
    ["this.route(router, { method: 'patch', path: '/x' })", 'a method property'],
  ])('fails for %s (%s) without a recorded write target', (source) => {
    project.write('server/routes/orders.ts', source);
    expect(checkTriggers(project.root)).toHaveLength(1);
  });

  test('ignores routes in comments', () => {
    project.write('server/routes/orders.ts', "// app.post('/x', h)\n/* router.put('/y', h) */\napp.get('/z', h);");
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('passes for GET routes', () => {
    project.write('server/routes/orders.ts', "app.get('/x', h); this.route(router, { method: 'get' });");
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('ignores test files', () => {
    project.write('server/routes/orders.test.ts', route);
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('passes once a design document records the write target', () => {
    project.write('server/routes/orders.ts', route);
    project.write(
      'docs/design/architecture.md',
      '# Architecture\n\n## Write target\n\nLakebase, because rows change in place.\n\n## Other\n'
    );
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test.each([
    ['an empty section', '## Write target\n\n## Other\n\ntext\n'],
    ['an empty section at the end', '## Write target\n'],
    ['a different heading', '## Writes\n\ntext\n'],
  ])('still fails with %s', (_name, document) => {
    project.write('server/routes/orders.ts', route);
    project.write('docs/design/architecture.md', document);
    expect(checkTriggers(project.root)).toHaveLength(1);
  });
});

describe('lakebase', () => {
  const sqlfluff = '[sqlfluff]\ndialect = postgres\n';
  const miseToml = '[tools]\n"pipx:squawk-cli" = "2.74.0"\n';

  test('fails when lakebase() is registered without Postgres linting or squawk', () => {
    project.write('server/server.ts', 'createApp({ plugins: [lakebase()] });');
    expect(checkTriggers(project.root)).toHaveLength(2);
  });

  test('fails when a migrations folder appears', () => {
    project.folder('config/database/migrations');
    expect(checkTriggers(project.root)).toHaveLength(2);
  });

  test('passes once Postgres linting and squawk are in place', () => {
    project.write('server/server.ts', 'createApp({ plugins: [lakebase()] });');
    project.write('config/database/.sqlfluff', sqlfluff).write('mise.toml', miseToml);
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('ignores plugin names that only appear in comments', () => {
    project.write(
      'server/server.ts',
      '// lakebase() comes later\n/* database() too */\ncreateApp({ plugins: [server()] });'
    );
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('does not accept the root sqlfluff configuration', () => {
    project.write('server/server.ts', 'lakebase();').write('.sqlfluff', sqlfluff).write('mise.toml', miseToml);
    expect(checkTriggers(project.root)).toHaveLength(1);
  });

  test('database() also needs a per-user authorization record', () => {
    project.write('server/server.ts', 'createApp({ plugins: [database()] });');
    project.write('config/database/.sqlfluff', sqlfluff).write('mise.toml', miseToml);
    expect(checkTriggers(project.root)).toHaveLength(1);
    project.write('docs/design/architecture.md', '## Per-user authorization\n\nRow filters in every query.\n');
    expect(checkTriggers(project.root)).toEqual([]);
  });
});

describe('on-behalf-of-user queries', () => {
  const query = 'config/queries/mine.obo.sql';

  test('fail without the sql scope', () => {
    project.write(query, 'select 1').write('databricks.yml', '      # user_api_scopes:\n      #   - sql\n');
    expect(checkTriggers(project.root)).toHaveLength(1);
  });

  test('fail when databricks.yml is missing', () => {
    project.write(query, 'select 1');
    expect(checkTriggers(project.root)).toHaveLength(1);
  });

  test('fail when the scope list has other scopes only', () => {
    project
      .write(query, 'select 1')
      .write('databricks.yml', 'x:\n  user_api_scopes:\n    - files.files\n  other: 1\n  - sql\n');
    expect(checkTriggers(project.root)).toHaveLength(1);
  });

  test.each([
    ['an indented list', 'x:\n  user_api_scopes:\n    - dashboards.genie\n    # note\n\n    - sql\n'],
    ['a list level with its key', 'user_api_scopes:\n- "sql"\n'],
  ])('pass with %s', (_name, bundle) => {
    project.write(query, 'select 1').write('databricks.yml', bundle);
    expect(checkTriggers(project.root)).toEqual([]);
  });

  test('are not required for ordinary queries', () => {
    project.write('config/queries/plain.sql', 'select 1');
    expect(checkTriggers(project.root)).toEqual([]);
  });
});
