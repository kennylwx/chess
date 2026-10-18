import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editGameInput } from '../dist/cli.js';

test('clears the whole game input with the terminal line-delete shortcut', () => {
  assert.equal(editGameInput('move the queen', '\x15', { ctrl: true, name: 'u' }), '');
  assert.equal(editGameInput('move the queen', '\x1b\x7f', { meta: true, name: 'backspace' }), '');
  assert.equal(editGameInput('move the queen', '\x7f', { name: 'backspace' }), 'move the quee');
});
