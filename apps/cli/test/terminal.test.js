import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
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
  for (const env of [{TERM: 'xterm-kitty'}, {TERM_PROGRAM: 'ghostty'}]) {
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
  assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 50), true);
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
    assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 10), false);
    assert.equal(t.input.isRaw, false);
    assert.equal(t.input.listenerCount('data'), 0);
    assert.equal(t.input.read(), null);
  }
});

test('text, redirected input and multiplexers do not receive probes', async () => {
  for (const [mode, tty, env] of [['ascii', true, {TERM: 'xterm-kitty'}], ['text', true, {}], ['auto', false, {}], ['auto', true, {TMUX: 'x'}], ['auto', true, {STY: 'x'}], ['auto', true, {TERM: 'dumb'}]]) {
    const t = terminal(null, {tty});
    assert.equal(await detectGraphics(mode, t.input, t.output, env), false);
    assert.equal(t.written(), '');
  }
});

test('explicit kitty override survives missing replies and restores existing raw mode', async () => {
  const t = terminal(null, {raw: true});
  assert.equal(await detectGraphics('kitty', t.input, t.output, {}, 10), true);
  assert.match(t.written(), /\x1b\[16t/);
  assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 10), false);
  assert.equal(t.input.isRaw, true);
});


test('measures fragmented cell geometry and keeps existing input consumers isolated', async () => {
  const t = terminal(input => {
    for (const chunk of ['\x1b[6;', '18;9t', 'e4', '\x1b[?1c']) input.write(chunk);
  });
  let keyboard = '';
  t.input.on('data', chunk => { keyboard += chunk; });
  let ratio;
  assert.equal(await detectGraphics('kitty', t.input, t.output, {}, 50, value => { ratio = value; }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ratio, 2);
  assert.equal(keyboard, 'e4');
});


test('Konsole auto stays text despite positive protocol capability; force remains explicit', async () => {
  for (const env of [{KONSOLE_VERSION: '250402'}, {TERM_PROGRAM: 'Konsole'}]) {
    const t = terminal(input => input.write('\x1b_Gi=73192;OK\x1b\\\x1b[?1c'));
    assert.equal(supportsGraphics('auto', true, env, true), false);
    assert.equal(await detectGraphics('auto', t.input, t.output, env, 50), false);
    assert.equal(t.written(), '');
    assert.equal(await detectGraphics('kitty', t.input, t.output, env, 50), true);
    assert.match(t.written(), /a=q/);
  }
});


test('unknown terminal identifiers never receive APC probes or change input state', async () => {
  for (const env of [{}, {TERM: 'xterm-256color'}, {TERM: 'xterm-256color', TERM_PROGRAM: 'qterminal'}]) {
    const t = terminal(() => { throw new Error('Unsupported terminal must not be queried'); });
    const paused = t.input.isPaused();
    assert.equal(supportsGraphics('auto', true, env, true), false);
    assert.equal(await detectGraphics('auto', t.input, t.output, env), false);
    assert.equal(t.written(), '');
    assert.equal(t.input.isRaw, false);
    assert.equal(t.input.isPaused(), paused);
    assert.equal(t.input.listenerCount('data'), 0);
  }
});

test('preserves split UTF-8 keyboard input through startup and resize probes', async () => {
  for (const flowing of [false, true]) {
    const t = terminal(input => {
      input.write(Buffer.from([0xe2]));
      input.write(Buffer.from([0x99, 0x94]));
      input.write(Buffer.from([0xf0, 0x9f]));
      input.write(Buffer.from([0x98, 0x80]));
      input.write('\x1b_Gi=73192;OK\x1b\\\x1b[?1c');
    }, {raw: flowing});
    let keyboard = '';
    if (flowing) t.input.on('data', chunk => { keyboard += chunk.toString(); });
    assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 50), true);
    await new Promise(resolve => setImmediate(resolve));
    if (!flowing) keyboard = t.input.read().toString();
    assert.equal(keyboard, '♔😀');
    assert.equal(t.input.isRaw, flowing);
  }
});

test('replays incomplete keyboard bytes unchanged on timeout and probe completion', async () => {
  for (const attributes of [false, true]) {
    const t = terminal(input => {
      const prefix = Buffer.from(attributes ? 'move\x1b[?1c' : 'move');
      input.write(Buffer.concat([prefix, Buffer.from([0xe2])]));
    });
    assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 20), false);
    assert.deepEqual(t.input.read(), Buffer.concat([Buffer.from('move'), Buffer.from([0xe2])]));
    assert.equal(t.input.listenerCount('data'), 0);
  }
});

test('handoff does not replay an incomplete protocol response', async () => {
  const t = terminal(input => {
    input.write(Buffer.concat([Buffer.from('e4\x1b_Gi=73192;'), Buffer.from([0xe2])]));
  });
  assert.equal(await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 20), false);
  assert.equal(t.input.read().toString(), 'e4');
});


test('downstream decoder completes keyboard UTF-8 across DA and timeout handoff', async () => {
  for (const attributes of [true, false]) {
    const t = terminal(input => {
      input.write(Buffer.concat([Buffer.from(attributes ? '\x1b[?1c' : ''), Buffer.from([0xe2])]));
    });
    const downstream = new StringDecoder('utf8');
    let text = '';
    t.input.on('data', chunk => { text += downstream.write(chunk); });
    await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 20);
    await new Promise(resolve => setImmediate(resolve));
    t.input.write(Buffer.from([0x99, 0x94]));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(text, '♔');
    assert.equal(downstream.end(), '');
  }
});


test('only actual EOF flushes truncated keyboard UTF-8 in the downstream decoder', async () => {
  const t = terminal(input => input.write(Buffer.from([0xe2])));
  const downstream = new StringDecoder('utf8');
  let text = '';
  t.input.on('data', chunk => { text += downstream.write(chunk); });
  const ended = new Promise(resolve => t.input.once('end', () => {
    text += downstream.end();
    resolve();
  }));
  await detectGraphics('auto', t.input, t.output, {TERM: 'xterm-kitty'}, 20);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(text, '');
  t.input.end();
  await ended;
  assert.equal(text, '\ufffd');
});
