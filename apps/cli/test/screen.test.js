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

test('keeps algebraic move history in the unfilled header above the board', () => {
  let output = '';
  const screen = new GameScreen(true, { columns: 80, write: text => { output += text; } });
  screen.draw('CHESS · White · Stockfish 1500', 'board frame', 'White plays e4', '1. e4 e5 2. Nf3');
  assert.ok(output.indexOf('CHESS · White') < output.indexOf('1. e4 e5'));
  assert.ok(output.indexOf('1. e4 e5') < output.indexOf('board frame'));
  assert.ok(output.includes('\r\n\r\nboard frame'));
  assert.ok(output.indexOf('board frame') < output.indexOf('White plays e4'));
  assert.match(output, /38;2;224;242;215m/);
  assert.match(output, /38;2;190;221;173m/);
  assert.match(output, /38;2;224;242;215m/);
  assert.ok(output.indexOf('\x1b[48;') > output.indexOf('board frame'));
});

test('keeps a distinct input field on the bottom row and replaces its placeholder', () => {
  let output = '';
  const screen = new GameScreen(true, { columns: 80, rows: 30, write: text => { output += text; } });
  screen.draw('Chess', 'board frame', 'Your move');
  assert.match(output, /\x1b\[28;1H/);
  assert.match(output, /\x1b\[29;1H/);
  assert.match(output, /\x1b\[30;1H/);
  assert.match(output, /\x1b\[26;1H.*Your move/s);
  assert.ok(output.indexOf('Your move') < output.indexOf('\x1b[28;1H'));
  assert.ok(!output.includes('▄'));
  assert.ok(!output.includes('▀'));
  assert.match(output, /38;2;190;221;173m/);
  assert.match(output, /\x1b\[29;1H/);
  assert.equal(output.match(/\x1b\[48;2;12;42;34m/g)?.length, 3);
  assert.ok(output.includes('Type any moves e.g. e4 or e pawn up 2'));
  assert.match(output, /\x1b\[29;2H\x1b\[5 q\x1b\[\?25h/);
  assert.ok(!output.includes('❯'));
  assert.match(output, /\/help/);
  assert.ok(!output.includes('Ctrl+U Undo  Ctrl+B Menu  Ctrl+C Quit'));
  output = '';
  screen.input('e2e4');
  assert.match(output, /\x1b\[29;1H/);
  assert.ok(output.includes('e2e4'));
  assert.match(output, /\x1b\[29;6H/);
  assert.match(output, /\x1b\[29;6H\x1b\[5 q\x1b\[\?25h/);
  assert.ok(!output.includes('Type any moves e.g. e4 or e pawn up 2'));
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
  screen.draw('LOAD GAME', '1 Saved game', '/back · /quit · Ctrl+C quit');
  screen.close();
  assert.equal(output.split('\x1b[?1049h').length - 1, 1);
  assert.equal(output.split('\x1b[H\x1b[2J').length - 1, 2);
  assert.ok(output.indexOf('CHESS') < output.indexOf('LOAD GAME'));
  assert.equal(output.match(/\x1b\[\?25l/g)?.length, 3);
  assert.match(output, /\/back · \/quit · Ctrl\+C quit/);
  assert.ok(!output.includes('\x1b[48;'));
  assert.ok(output.endsWith('\x1b[?25h\x1b[?1049l'));
});
