import { listFiles, readIfPresent } from './lib/files.ts';

const ROOT_AGENTS_LIMIT = 12_000;
const LAYER_AGENTS_LIMIT = 4_000;
const SKILL_CHARACTER_LIMIT = 20_000;
const SKILL_LINE_LIMIT = 500;

/** Counts characters the way `wc -m` does (code points, not UTF-16 units), because one long paragraph is one line. */
function characters(text: string): number {
  return Array.from(text).length;
}

/** Counts lines the way `wc -l` does, so a file that ends with a newline doesn't gain a line. */
function lines(text: string): number {
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
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

function checkAgentsFile(path: string, text: string): string[] {
  const limit = path === 'AGENTS.md' ? ROOT_AGENTS_LIMIT : LAYER_AGENTS_LIMIT;
  const length = characters(text);
  if (length < limit) return [];
  return [
    `${path} has ${length} characters; the limit is under ${limit}. Agents load it into every session, so ` +
      'keep the rules that apply everywhere here and move detail to a document in docs/ that it links to.',
  ];
}

function checkSkillFile(path: string, text: string): string[] {
  const length = characters(text);
  const lineCount = lines(text);
  if (length < SKILL_CHARACTER_LIMIT && lineCount < SKILL_LINE_LIMIT) return [];
  return [
    `${path} has ${lineCount} lines and ${length} characters; a skill stays under ${SKILL_LINE_LIMIT} lines and ` +
      `${SKILL_CHARACTER_LIMIT} characters. Move reference material into files beside SKILL.md and link to them.`,
  ];
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
  return listFiles(root).flatMap((path) => {
    const parts = path.split('/');
    const name = parts.at(-1);
    if (name === 'AGENTS.md') return checkAgentsFile(path, readIfPresent(root, path));
    if (name === 'SKILL.md' && !installed.has(parts.at(-2) ?? '')) {
      return checkSkillFile(path, readIfPresent(root, path));
    }
    return [];
  });
}

if (import.meta.main) {
  const problems = checkSizes(process.cwd());
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
