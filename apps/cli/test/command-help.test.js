import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandHelp } from '../dist/cli.js';

test('in-game help lists commands and a route back to the game without listing chess moves', () => {
  const help = commandHelp();
  for (const command of ['/help', '/undo', '/fen', '/fen <FEN>', '/back', '/quit', 'Ctrl+C']) {
    assert.ok(help.includes(command), `help should include ${command}`);
  }
  assert.ok(!help.includes('Ctrl+B'));
  assert.ok(!help.includes('/game'));
  assert.ok(!help.includes('Ctrl+U'));
  assert.doesNotMatch(help, /\b(?:e4|Nf3|exd5|e2e4)\b/);
});
