import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Fixture } from './lib/fixture.ts';
import { planSqlChecks } from './lint-sql.ts';

let project: Fixture;
beforeEach(() => {
  project = new Fixture();
});
afterEach(() => {
  project.dispose();
});

describe('planSqlChecks', () => {
  test('has nothing to check in a project without SQL', () => {
    expect(planSqlChecks(project.root)).toEqual([]);
  });

  test('lints analytics queries', () => {
    project.write('config/queries/sales.sql', 'select 1');
    expect(planSqlChecks(project.root)).toEqual([['sqlfluff', 'lint', 'config/queries']]);
  });

  test('lints Lakebase SQL and checks its migrations with squawk', () => {
    project.write('config/database/migrations/001-init.sql', 'select 1');
    project.write('config/database/seed.sql', 'select 1');
    expect(planSqlChecks(project.root)).toEqual([
      ['sqlfluff', 'lint', 'config/database'],
      ['squawk', 'config/database/migrations/001-init.sql'],
    ]);
  });

  test('lints a migrations folder that lives elsewhere', () => {
    project.write('server/migrations/001-init.sql', 'select 1');
    expect(planSqlChecks(project.root)).toEqual([
      ['sqlfluff', 'lint', 'server/migrations'],
      ['squawk', 'server/migrations/001-init.sql'],
    ]);
  });
});
