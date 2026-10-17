import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameScreen } from '../dist/screen.js';

test('replaces frames in one alternate screen and restores the shell once', () => {
  let output = '';
  const screen = new GameScreen(true, { columns: 80, write: text => { output += text; } });
  screen.open();
  screen.draw('Chess', 'position one', 'Your move');
  screen.draw('Chess', 'position two', 'Black plays e5');
  screen.close();
  screen.close();
  assert.equal(output.split('\x1b[?1049h').length - 1, 1);
  assert.equal(output.split('\x1b[H\x1b[2J').length - 1, 2);
  assert.equal(output.split('\x1b[?1049l').length - 1, 1);
  assert.ok(output.endsWith('\x1b[?1049l'));
});

test('keeps status text on one row, without interpreting control sequences', () => {
  let output = '';
  const screen = new GameScreen(true, { columns: 20, write: text => { output += text; } });
  screen.draw('Chess', '', 'Invalid move\nTry a different move');
  assert.match(output, /Invalid move Try a /);
  assert.ok(!output.includes('Invalid move\n'));
});

test('redirected output remains plain text', () => {
  let output = '';
  const screen = new GameScreen(false, { write: text => { output += text; } });
  screen.open();
  screen.draw('Chess', 'board', 'Your move');
  screen.close();
  assert.ok(!output.includes('\x1b'));
});
