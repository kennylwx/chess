import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@zchess/chess';
import { render } from '../dist/ui.js';

test('text board squares have room to render square instead of tall cells', () => {
  const lines = render(new Chess(), { color: false }).trimEnd().split('\n');
  assert.equal(lines[0].length, 53);
  assert.equal(lines[2].length, 53);
  assert.ok(lines[2].includes('  ♜   '));
});


test('compact fallback reduces both dimensions and narrow boards do not wrap', () => {
  const columns = process.stdout.columns;
  try {
    const compact = render(new Chess(), { color: false, compact: true }).trimEnd().split('\n');
    assert.equal(compact[0].length, 21);
    assert.equal(compact.length, 12);
    process.stdout.columns = 40;
    const narrow = render(new Chess(), { color: false }).trimEnd().split('\n');
    assert.ok(narrow.every(line => line.length <= 40));
  } finally { process.stdout.columns = columns; }
});


test('board labels use default foreground while colored squares retain piece contrast', () => {
  const output = render(new Chess(), { color: true });
  assert.ok(!output.includes('38;5;114m'));
  assert.match(output, /\x1b\[39m   \+/);
  assert.match(output, /\x1b\[39m    ♔ White    ♚ Black/);
  assert.match(output, /48;5;\d+;38;5;231m/);
  assert.match(output, /48;5;\d+;38;5;16m/);
});
