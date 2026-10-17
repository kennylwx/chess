import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@chess/chess';
import { render } from '../dist/ui.js';

test('text board squares have room to render square instead of tall cells', () => {
  const lines = render(new Chess(), { color: false }).trimEnd().split('\n');
  assert.equal(lines[0].length, 69);
  assert.equal(lines[2].length, 69);
  assert.ok(lines[2].includes('   ♜    '));
});
