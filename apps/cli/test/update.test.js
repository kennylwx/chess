import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkForUpdate, isNewerVersion } from '../dist/update.js';

for (const [candidate, installed, expected] of [
  ['0.1.7', '0.1.6', true], ['1.0.0', '0.99.99', true],
  ['0.1.10', '0.1.9', true], ['0.1.6', '0.1.6', false],
  ['0.1.5', '0.1.6', false], ['0.1.6-alpha.10', '0.1.6-alpha.9', true],
  ['0.1.6', '0.1.6-alpha.9', true], ['0.1.6-alpha.9', '0.1.6', false],
  ['0.1.6-beta.1', '0.1.6-alpha.9', true], ['0.1.6-alpha.1', '0.1.6-alpha', true],
  ['0.1.6+build.2', '0.1.6+build.1', false], ['bad', '0.1.6', false],
  ['0.1.6; echo bad', '0.1.5', false], ['01.2.3', '0.1.6', false],
  ['0.1.6-alpha.01', '0.1.6-alpha.0', false],
]) {
  test(`compares ${candidate} against ${installed}`, () => {
    assert.equal(isNewerVersion(candidate, installed), expected);
  });
}

const registry = tags => async (url, options) => {
  assert.equal(url, 'https://registry.npmjs.org/-/package/zchess/dist-tags');
  assert.ok(options.signal instanceof AbortSignal);
  return Response.json(tags);
};

test('offers an explicit npm command for a newer stable release', async () => {
  assert.deepEqual(await checkForUpdate('0.1.6', { fetch: registry({ latest: '0.2.0', alpha: '0.3.0-alpha.0' }) }), {
    version: '0.2.0', command: 'npm install --global zchess@0.2.0',
  });
});

test('tracks alpha releases and also detects graduation to stable', async () => {
  assert.equal((await checkForUpdate('0.1.6-alpha.0', { fetch: registry({ alpha: '0.1.6-alpha.1' }) })).version, '0.1.6-alpha.1');
  assert.equal((await checkForUpdate('0.1.6-alpha.0', { fetch: registry({ latest: '0.2.0', alpha: '0.1.7-alpha.0' }) })).version, '0.2.0');
});

test('Homebrew shows its formula update command and ignores alpha releases', async () => {
  const options = { homebrew: true, fetch: registry({ latest: '0.2.0', alpha: '0.3.0-alpha.0' }) };
  const update = await checkForUpdate('0.1.6', options);
  assert.equal(update.version, '0.2.0');
  assert.equal(update.command, `brew reinstall --formula \\
  https://github.com/kennylwx/zchess/releases/latest/download/zchess.rb`);
});

test('does not notify for equal, older, absent, or malformed registry versions', async () => {
  for (const tags of [{ latest: '0.1.6' }, { latest: '0.1.5' }, {}, null, { latest: '\u001b[31m2.0.0' }]) {
    assert.equal(await checkForUpdate('0.1.6', { fetch: registry(tags) }), undefined);
  }
});

test('offline, HTTP, and invalid JSON responses never prevent startup', async () => {
  for (const fetch of [async () => { throw new TypeError('fetch failed'); }, async () => new Response('', { status: 503 }), async () => new Response('bad json')]) {
    assert.equal(await checkForUpdate('0.1.6', { fetch }), undefined);
  }
});

test('times out and aborts even if the network lookup never resolves', async () => {
  let signal;
  const fetch = async (_url, options) => { signal = options.signal; return new Promise(() => {}); };
  assert.equal(await checkForUpdate('0.1.6', { fetch, timeoutMs: 10 }), undefined);
  assert.equal(signal.aborted, true);
});

// Exercise startup and the rendered menu, not only the registry lookup helper.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec = promisify(execFile);
for (const mode of ['newer', 'current', 'offline', 'disabled', 'help']) {
  test(`interactive startup: ${mode}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zchess-update-'));
    const moduleUrl = new URL('../dist/cli.js', import.meta.url).href;
    const script = `
      import { run } from ${JSON.stringify(moduleUrl)};
      process.stdin.isTTY = process.stdout.isTTY = true;
      process.stdout.columns = 200;
      process.stdin.setRawMode = active => {
        if (active) setImmediate(() => process.stdin.emit('keypress', '3', {}));
      };
      const mode = ${JSON.stringify(mode)};
      globalThis.fetch = async () => {
        if (mode === 'disabled' || mode === 'help') throw new Error('Unexpected update lookup');
        if (mode === 'offline') throw new TypeError('fetch failed');
        return Response.json({ latest: mode === 'current' ? '1.0.0' : '1.1.0' });
      };
      let calls = 0;
      const lookup = globalThis.fetch;
      globalThis.fetch = (...args) => { calls++; return lookup(...args); };
      await run(mode === 'help' ? ['--help'] : [], { version: '1.0.0' });
      if ((mode === 'disabled' || mode === 'help') && calls) throw new Error('Update lookup was not skipped');
    `;
    try {
      const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, ZCHESS_DB_PATH: join(directory, 'games.sqlite'), ZCHESS_NO_UPDATE_CHECK: mode === 'disabled' ? '1' : '0' }, timeout: 5000,
      });
      if (mode === 'newer') {
        assert.match(stdout, /Update available: 1\.0\.0 → 1\.1\.0/);
        assert.match(stdout, /npm install --global zchess@1\.1\.0/);
      } else assert.doesNotMatch(stdout, /Update available/);
      if (mode !== 'help') assert.match(stdout, /Play/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
