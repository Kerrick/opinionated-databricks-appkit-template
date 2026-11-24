import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { browserLaunchOptions, installBrowserLibraries } from './browser-libraries.ts';

// The browser-based tests drive Chromium, which Playwright downloads. The
// download needs no account or token. On Linux, Chromium also links against
// shared libraries; the project brings its own (see browser-libraries.ts), and
// this script stops early with the names of any that are still missing,
// instead of leaving each test to fail on its own.

const playwrightCli = path.join(
  path.dirname(createRequire(import.meta.url).resolve('playwright/package.json')),
  'cli.js'
);

function playwright(args: readonly string[]): boolean {
  return spawnSync(process.execPath, [playwrightCli, ...args], { stdio: 'inherit' }).status === 0;
}

/** The shared libraries Chromium links against that this machine lacks. */
function missingLibraries(): string[] {
  const listing = spawnSync('/usr/bin/ldd', [chromium.executablePath()], {
    encoding: 'utf8',
    ...browserLaunchOptions(),
  });
  if (listing.error || listing.status !== 0) return [];
  return listing.stdout
    .split('\n')
    .filter((line) => line.includes('not found'))
    .map((line) => line.trim().split(' ')[0] ?? line.trim());
}

if (!installBrowserLibraries() || !playwright(['install', 'chromium'])) {
  process.exit(1);
}

if (process.platform === 'linux') {
  const missing = missingLibraries();
  if (missing.length > 0) {
    console.error(`Chromium cannot start: these system libraries are missing: ${missing.join(', ')}.`);
    process.exit(1);
  }
}
