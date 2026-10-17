import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameScreen, MenuScreen } from '../dist/screen.js';

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
  const screen = new GameScreen(true, { columns: 80, write: text => { output += text; } });
  screen.draw('Chess', '', 'Invalid move\nTry a different move');
  assert.match(output, /Invalid move Try a /);
  assert.ok(!output.includes('Invalid move\n'));
});

test('keeps algebraic move history in the shaded header above the board', () => {
  let output = '';
  const screen = new GameScreen(true, { columns: 80, write: text => { output += text; } });
  screen.draw('CHESS · White · Stockfish 1500', 'board frame', 'White plays e4', '1. e4 e5 2. Nf3');
  assert.ok(output.indexOf('CHESS · White') < output.indexOf('1. e4 e5'));
  assert.ok(output.indexOf('1. e4 e5') < output.indexOf('board frame'));
  assert.ok(output.indexOf('board frame') < output.indexOf('White plays e4'));
  assert.match(output, /48;2;22;53;37m/);
  assert.match(output, /48;2;35;49;39m/);
});

test('redirected output remains plain text', () => {
  let output = '';
  const screen = new GameScreen(false, { write: text => { output += text; } });
  screen.open();
  screen.draw('Chess', 'board', 'Your move');
  screen.close();
  assert.ok(!output.includes('\x1b'));
});

test('menu screens replace content in one alternate screen and restore the shell', () => {
  let output = '';
  const screen = new MenuScreen(true, { columns: 80, write: text => { output += text; } });
  screen.open();
  screen.draw('CHESS', '1 Play\n2 Load', 'Press a number');
  screen.draw('LOAD GAME', '1 Saved game\nEsc Back', 'Press a game number or Esc');
  screen.close();
  assert.equal(output.split('\x1b[?1049h').length - 1, 1);
  assert.equal(output.split('\x1b[H\x1b[2J').length - 1, 2);
  assert.ok(output.indexOf('CHESS') < output.indexOf('LOAD GAME'));
  assert.ok(output.endsWith('\x1b[?25h\x1b[?1049l'));
});
