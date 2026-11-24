import { listFiles, readIfPresent } from './lib/files.ts';

const ROOT_AGENTS_LIMIT = 12_000;
const LAYER_AGENTS_LIMIT = 4_000;
const SKILL_CHARACTER_LIMIT = 20_000;
const SKILL_LINE_LIMIT = 500;

/** Counts characters the way `wc -m` does (code points, not UTF-16 units), because one long paragraph is one line. */
function characters(text: string): number {
  return Array.from(text).length;
}

/** Names of the skills installed from skills-lock.json. They aren't this project's own files, so they're not measured. */
function installedSkillNames(root: string): Set<string> {
  const lock: unknown = JSON.parse(readIfPresent(root, 'skills-lock.json') || '{}');
  const skills = typeof lock === 'object' && lock !== null && 'skills' in lock ? lock.skills : undefined;
  if (Array.isArray(skills)) {
    return new Set(
      skills.flatMap((entry: unknown) =>
        typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string'
          ? [entry.name]
          : []
      )
    );
  }
  return new Set(typeof skills === 'object' && skills !== null ? Object.keys(skills) : []);
}

/**
 * Fails when an instruction file is too long to be read in full on every task.
 *
 * The root AGENTS.md must stay under 12,000 characters and each AGENTS.md below it under 4,000: they are
 * loaded into every session, so every extra paragraph costs attention on every task. Each project-owned
 * SKILL.md stays under 500 lines and 20,000 characters, about the size agent-skill tooling recommends.
 */
export function checkSizes(root: string): string[] {
  const installed = installedSkillNames(root);
  const problems: string[] = [];
  for (const path of listFiles(root)) {
    const name = path.split('/').at(-1);
    const text = name === 'AGENTS.md' || name === 'SKILL.md' ? readIfPresent(root, path) : '';
    if (name === 'AGENTS.md') {
      const limit = path === 'AGENTS.md' ? ROOT_AGENTS_LIMIT : LAYER_AGENTS_LIMIT;
      const length = characters(text);
      if (length >= limit) {
        problems.push(
          `${path} has ${length} characters; the limit is under ${limit}. Agents load it into every session, so ` +
            'keep the rules that apply everywhere here and move detail to a document in docs/ that it links to.'
        );
      }
    }
    if (name === 'SKILL.md' && !installed.has(path.split('/').at(-2) ?? '')) {
      const length = characters(text);
      const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
      if (length >= SKILL_CHARACTER_LIMIT || lines >= SKILL_LINE_LIMIT) {
        problems.push(
          `${path} has ${lines} lines and ${length} characters; a skill stays under ${SKILL_LINE_LIMIT} lines and ` +
            `${SKILL_CHARACTER_LIMIT} characters. Move reference material into files beside SKILL.md and link to them.`
        );
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const problems = checkSizes(process.cwd());
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
