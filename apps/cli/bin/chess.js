#!/usr/bin/env node
import { loadEnvFile } from 'node:process';
import { run } from '../dist/cli.js';

try {
  loadEnvFile(new URL('../../../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

run(process.argv.slice(2)).catch(error => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
