import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@zchess/chess';
import { boardSvg, clearGraphics, renderGraphics } from '../dist/graphics.js';

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

test('fits one aspect-preserving dimension using measured cell geometry', () => {
  const originalRows = process.stdout.rows;
  const originalColumns = process.stdout.columns;
  try {
    for (const [width, height, ratio] of [[80, 40, 2], [45, 20, 2.2], [120, 50, 1.5], [40, 40, 2]]) {
      process.stdout.columns = width;
      process.stdout.rows = height;
      const output = renderGraphics(new Chess(), 'w', null, true, ratio);
      const command = output.match(/a=T[^;]+/)[0];
      const columns = command.match(/,c=(\d+)/);
      const rows = command.match(/,r=(\d+)/);
      assert.notEqual(Boolean(columns), Boolean(rows));
      if (columns) {
        assert.equal(Number(columns[1]), width - 2);
        assert.ok(Math.ceil(Number(columns[1]) / ratio) <= height - 8);
      } else {
        assert.equal(Number(rows[1]), Math.min(32, height - 8));
        assert.ok(Number(rows[1]) * ratio <= width - 2);
      }
      assert.ok(output.startsWith(clearGraphics()));
    }
  } finally {
    process.stdout.rows = originalRows;
    process.stdout.columns = originalColumns;
  }
});

test('cleanup deletes only the board image and frees its data without replies', () => {
  assert.equal(clearGraphics(), '\x1b_Ga=d,d=I,i=73191,q=2;\x1b\\');
});
