import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@chess/chess';
import { boardSvg, renderGraphics, supportsGraphics } from '../dist/graphics.js';

test('enables images in Ghostty but keeps redirected output and unsupported terminals as text', () => {
  assert.equal(supportsGraphics('auto', true, { TERM_PROGRAM: 'ghostty' }), true);
  assert.equal(supportsGraphics('auto', false, { TERM_PROGRAM: 'ghostty' }), false);
  assert.equal(supportsGraphics('auto', true, { TERM_PROGRAM: 'Apple_Terminal' }), false);
  assert.equal(supportsGraphics('auto', true, { TERM_PROGRAM: 'ghostty', TMUX: 'session' }), false);
  assert.equal(supportsGraphics('text', true, { TERM_PROGRAM: 'ghostty' }), false);
  assert.equal(supportsGraphics('kitty', true, {}), true);
});

test('renders traditional pieces in the correct orientation and highlights moves', () => {
  const chess = new Chess();
  const white = boardSvg(chess, 'w', null);
  const black = boardSvg(chess, 'b', null);
  assert.ok(white.indexOf('black-rook') < white.indexOf('white-rook'));
  assert.ok(black.indexOf('white-rook') < black.indexOf('black-rook'));
  chess.play('e2e4');
  const moved = boardSvg(chess, 'w', [52, 36]);
  assert.equal((moved.match(/fill="#b4cf68"/g) || []).length, 2);
  assert.equal((moved.match(/class="white pawn"/g) || []).length, 8);
});

test('transmits a real PNG in bounded chunks with terminal responses disabled', () => {
  const output = renderGraphics(new Chess(), 'w', null);
  const commands = [...output.matchAll(/\x1b_G([^;]*);([^\x1b]*)\x1b\\/g)];
  const image = commands.filter(command => command[2].length);
  assert.ok(image.length > 1);
  assert.match(image[0][1], /a=T,f=100/);
  assert.match(image[0][1], /C=1,q=2/);
  assert.match(image.at(-1)[1], /m=0/);
  for (const command of image) assert.ok(command[2].length <= 4096);
  const png = Buffer.from(image.map(command => command[2]).join(''), 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 768);
  assert.equal(png.readUInt32BE(20), 768);
});

test('fixed board updates do not reserve new lines or scroll the terminal', () => {
  const output = renderGraphics(new Chess(), 'w', null, true);
  assert.ok(!output.includes('\n'));
  assert.match(output, /C=1,q=2/);
});

test('fits the image into a square terminal footprint', () => {
  const output = renderGraphics(new Chess(), 'w', null);
  const placement = output.match(/c=(\d+),r=(\d+)/);
  assert.ok(placement);
  assert.equal(Number(placement[1]), Number(placement[2]) * 2);
});
