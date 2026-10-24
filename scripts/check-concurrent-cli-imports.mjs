import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = new URL('../packages/chess/dist/', import.meta.url);
const cli = new URL('../apps/cli/dist/cli.js', import.meta.url).href;
const files = (await readdir(dist)).filter(name => name.endsWith('.js'));
async function snapshot() {
  return Promise.all(files.map(async name => {
    const info = await stat(new URL(name, dist), { bigint: true });
    return [name, info.size, info.mtimeNs, info.ctimeNs];
  }));
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}:\n${output}`)));
  });
}

// Real package tests and repeated fresh CLI module graphs run concurrently.
// Checking file metadata makes unintended rebuilding fail deterministically,
// even when a particular run does not hit the short truncate/write window.
const before = await snapshot();
const jobs = [run('pnpm', ['--filter', '@zchess/chess', 'test'])];
for (let worker = 0; worker < 2; worker++) jobs.push((async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    await run(process.execPath, ['--input-type=module', '-e', `import { run } from ${JSON.stringify(cli)}; await run(['--help']);`]);
  }
})());
const results = await Promise.allSettled(jobs);
for (const result of results) if (result.status === 'rejected') throw result.reason;
assert.deepEqual(await snapshot(), before, 'Chess tests rewrote shared dist files while CLI consumers were running');
console.log('Chess tests + 24 fresh CLI imports passed; shared JavaScript outputs were not rewritten.');
