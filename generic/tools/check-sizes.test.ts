import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { checkSizes } from './check-sizes.ts';
import { Fixture } from './lib/fixture.ts';

let project: Fixture;
beforeEach(() => {
  project = new Fixture();
});
afterEach(() => {
  project.dispose();
});

describe('AGENTS.md', () => {
  test('passes just under the limits', () => {
    project.write('AGENTS.md', 'x'.repeat(11_999)).write('server/AGENTS.md', 'x'.repeat(3_999));
    expect(checkSizes(project.root)).toEqual([]);
  });

  test('fails the root file at 12,000 characters', () => {
    project.write('AGENTS.md', 'x'.repeat(12_000));
    const [problem, ...rest] = checkSizes(project.root);
    expect(rest).toEqual([]);
    expect(problem).toContain('AGENTS.md has 12000 characters');
  });

  test('fails a layer file at 4,000 characters', () => {
    project.write('client/src/domain/AGENTS.md', 'x'.repeat(4_000));
    expect(checkSizes(project.root)).toHaveLength(1);
  });

  test('counts characters, not bytes', () => {
    project.write('server/AGENTS.md', 'é'.repeat(3_999));
    expect(checkSizes(project.root)).toEqual([]);
  });
});

describe('SKILL.md', () => {
  test('passes a short skill', () => {
    project.write('.agents/skills/mine/SKILL.md', '---\nname: mine\n---\nShort.\n');
    expect(checkSizes(project.root)).toEqual([]);
  });

  test('passes a skill with 499 lines', () => {
    project.write('.agents/skills/mine/SKILL.md', 'a\n'.repeat(499));
    expect(checkSizes(project.root)).toEqual([]);
  });

  test('fails a skill with 500 lines', () => {
    project.write('.agents/skills/mine/SKILL.md', 'a\n'.repeat(500));
    expect(checkSizes(project.root)).toHaveLength(1);
  });

  test('fails a skill with 20,000 characters on few lines', () => {
    project.write('.agents/skills/mine/SKILL.md', 'x'.repeat(20_000));
    expect(checkSizes(project.root)).toHaveLength(1);
  });

  test.each([
    ['an object', '{"skills":{"adr":{"source":"x"}}}'],
    ['a list', '{"skills":[{"name":"adr"}, 3, {"name":7}]}'],
  ])('skips skills installed from the lockfile (%s)', (_name, lock) => {
    project.write('skills-lock.json', lock);
    project.write('.agents/skills/adr/SKILL.md', 'x'.repeat(30_000));
    expect(checkSizes(project.root)).toEqual([]);
  });

  test('measures a skill the lockfile does not list', () => {
    project.write('skills-lock.json', '{}');
    project.write('.agents/skills/mine/SKILL.md', 'x'.repeat(30_000));
    expect(checkSizes(project.root)).toHaveLength(1);
  });

  test('copes with a lockfile that is not an object', () => {
    project.write('skills-lock.json', '[]');
    project.write('.agents/skills/mine/SKILL.md', 'short');
    expect(checkSizes(project.root)).toEqual([]);
  });
});
