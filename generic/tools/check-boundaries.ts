import { existsSync } from 'node:fs';
import { cruise, format } from 'dependency-cruiser';
import extractConfig from 'dependency-cruiser/config-utl/extract-depcruise-config';

const FOLDERS = ['client/src', 'server', 'shared', 'config', 'tools'];

/**
 * Runs the dependency-cruiser rules in `.dependency-cruiser.mjs` over the project's source folders.
 * Run it from the project root: the rules match paths relative to it.
 *
 * Returns whether the rules passed, with the report to print. A run that finds no modules at all fails too: on some TypeScript versions dependency-cruiser analyses nothing and reports success, which
 * would switch every architecture rule off without anyone noticing.
 */
export async function checkBoundaries(root: string): Promise<{ report: string; passed: boolean }> {
  const configPath = `${root}/.dependency-cruiser.mjs`;
  const ruleSet = await extractConfig(configPath);
  const folders = FOLDERS.filter((folder) => existsSync(`${root}/${folder}`));
  const result = await cruise(folders, {
    ...ruleSet.options,
    ruleSet,
    validate: true,
    tsConfig: { fileName: `${root}/tsconfig.client.json` },
  });
  if (typeof result.output === 'string') {
    return { report: 'dependency-cruiser returned text, not a result object', passed: false };
  }
  if (result.output.summary.totalCruised === 0) {
    return {
      report:
        'dependency-cruiser analysed no modules, so no architecture rule was checked. ' +
        'Check that the TypeScript it loads is the 6.0 alias (tsc6), not 7.0, and that the source folders exist.',
      passed: false,
    };
  }
  const report = await format(result.output, { outputType: 'err' });
  return { report: typeof report.output === 'string' ? report.output : '', passed: result.output.summary.error === 0 };
}

if (import.meta.main) {
  const { report, passed } = await checkBoundaries(process.cwd());
  console[passed ? 'log' : 'error'](report.trim());
  process.exitCode = passed ? 0 : 1;
}
