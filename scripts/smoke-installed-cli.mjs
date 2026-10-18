import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const executable = process.argv[2];
if (!executable) throw new Error('Usage: node smoke-installed-cli.mjs CHESS_EXECUTABLE');

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'chess-cli-smoke-'));
const child = spawn(executable, ['--elo', '1500', '--db', join(temporaryDirectory, 'games.sqlite')], { stdio: ['pipe', 'pipe', 'pipe'] });
let output = '';
let sentQuit = false;
const timeout = setTimeout(() => child.kill('SIGKILL'), 20_000);
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', data => {
  output += data;
  if (!sentQuit && /Black plays \S+/.test(output)) {
    sentQuit = true;
    child.stdin.write('/quit\n');
  }
});
child.stderr.on('data', data => { output += data; });
child.stdin.write('e2e4\n');

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => resolve(code));
});
clearTimeout(timeout);
try {
  assert.equal(exitCode, 0, `CLI exited with ${exitCode}:\n${output}`);
  assert.match(output, /Black plays \S+/, `Stockfish did not return a move:\n${output}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
