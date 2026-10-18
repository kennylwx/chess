import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess, START_FEN } from '@zchess/chess';
import { engineMove } from '../dist/engine.js';

for (const side of ['white', 'black']) {
  test(`bundled Stockfish returns a legal ${side} move without a server`, { timeout: 15000 }, async () => {
    const position = new Chess(START_FEN);
    if (side === 'black') position.play('e2e4');
    const move = await engineMove(position.fen(), 1500, 2);
    assert.match(move, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
    assert.doesNotThrow(() => position.play(move));
  });
}

test('rejects invalid engine settings before starting Stockfish', async () => {
  await assert.rejects(engineMove(START_FEN, 100, 2), /ELO/);
  await assert.rejects(engineMove(START_FEN, 1500, 0), /Depth/);
});

test('cancels an active search so Ctrl+C can restore the terminal immediately', async () => {
  const abort = new AbortController();
  const search = engineMove(START_FEN, 1500, 30, abort.signal);
  abort.abort();
  await assert.rejects(search, /cancelled/);
});
