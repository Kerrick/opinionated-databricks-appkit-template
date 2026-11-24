import { spawnSync } from 'node:child_process';
import process from 'node:process';

// `pnpm run build` generates the plugins' query types the way a production
// build does, with NODE_ENV=production. Setting a variable in front of the
// command (`NODE_ENV=production appkit ...`) only works in a POSIX shell, so
// this script sets it for the child process instead and runs on every OS.
const result = spawnSync('appkit', ['generate-types', '--wait'], {
  stdio: 'inherit',
  // On Windows the `appkit` binary is a .cmd shim, which needs a shell.
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_ENV: 'production' },
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
