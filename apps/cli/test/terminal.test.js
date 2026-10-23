import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { detectGraphics, supportsGraphics } from '../dist/terminal.js';

function terminal(reply, { tty = true, raw = false } = {}) {
  const input = new PassThrough();
  input.isTTY = tty;
  input.isRaw = raw;
  input.setRawMode = value => { input.isRaw = value; };
  let written = '';
  const output = { isTTY: tty, write: value => {
    written += value;
    if (reply) setImmediate(() => reply(input));
  } };
  return { input, output, written: () => written };
}

test('environment hints alone never prove automatic graphics support', () => {
  for (const env of [{TERM: 'xterm-kitty'}, {TERM_PROGRAM: 'ghostty'}, {}]) {
    assert.equal(supportsGraphics('auto', true, env), false);
    assert.equal(supportsGraphics('auto', true, env, true), true);
  }
  assert.equal(supportsGraphics('auto', true, {TMUX: 'x'}, true), false);
  assert.equal(supportsGraphics('auto', true, {STY: 'x'}, true), false);
  assert.equal(supportsGraphics('kitty', true, {}), true);
  assert.equal(supportsGraphics('kitty', false, {}), false);
});

test('accepts fragmented runtime confirmation, consumes replies and preserves typed keys', async () => {
  const t = terminal(input => {
    for (const chunk of ['e', '\x1b_', 'Gi=73192;', 'OK\x1b', '\\', '\x1b[?', '1;2c', '4']) input.write(chunk);
  });
  assert.equal(await detectGraphics('auto', t.input, t.output, {}, 50), true);
  assert.match(t.written(), /a=q/);
  assert.ok(!t.written().includes('a=T'));
  assert.equal(t.input.isRaw, false);
  assert.equal(t.input.isPaused(), true);
  assert.equal(t.input.read().toString(), 'e4');
  assert.equal(t.input.listenerCount('data'), 0);
});

test('negative, absent and mismatched responses fall back to text', async () => {
  for (const response of ['\x1b[?1;2c', '\x1b_Gi=73192;ENOTSUP\x1b\\\x1b[?1c', '\x1b_Gi=99;OK\x1b\\\x1b[?1c', '']) {
    const t = terminal(input => input.write(response));
    assert.equal(await detectGraphics('auto', t.input, t.output, {}, 10), false);
    assert.equal(t.input.isRaw, false);
    assert.equal(t.input.listenerCount('data'), 0);
    assert.equal(t.input.read(), null);
  }
});

test('text, redirected input and multiplexers do not receive probes', async () => {
  for (const [mode, tty, env] of [['text', true, {}], ['auto', false, {}], ['auto', true, {TMUX: 'x'}], ['auto', true, {STY: 'x'}], ['auto', true, {TERM: 'dumb'}]]) {
    const t = terminal(null, {tty});
    assert.equal(await detectGraphics(mode, t.input, t.output, env), false);
    assert.equal(t.written(), '');
  }
});

test('explicit kitty override skips probing and timeout restores existing raw mode', async () => {
  const t = terminal(null, {raw: true});
  assert.equal(await detectGraphics('kitty', t.input, t.output, {}), true);
  assert.equal(t.written(), '');
  assert.equal(await detectGraphics('auto', t.input, t.output, {}, 10), false);
  assert.equal(t.input.isRaw, true);
});
