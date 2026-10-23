#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

// Node 22 labels its built-in SQLite module experimental. Keep that runtime
// notice out of the player-facing menu while leaving other warnings intact.
if (!process.execArgv.includes('--disable-warning=ExperimentalWarning')) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const { loadEnvFile } = await import('node:process');
const { run } = await import('../dist/cli.bundle.js');

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const homebrew = /[\\/](?:Cellar|Homebrew)[\\/]/i.test(fileURLToPath(import.meta.url));
run(process.argv.slice(2), { version, homebrew }).catch(error => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
