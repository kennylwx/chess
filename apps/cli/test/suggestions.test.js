import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@zchess/chess';
import { modelInput } from '../dist/input.js';
import { ResolutionError } from '../dist/api.js';
import { suggestMoves } from '../dist/suggestions.js';

const capturePosition = 'k7/8/8/8/4r3/3K4/8/8 w - - 0 1';

test('missing capture marker suggests the matching capture without calling JEV or moving', async () => {
  const chess = new Chess(capturePosition);
  const server = { resolve: async () => { assert.fail('Notation must never be reinterpreted by JEV'); } };
  await assert.rejects(modelInput('Ke4', chess, server), /Try: Kxe4/);
  assert.equal(chess.fen(), capturePosition);
  assert.equal(chess.history.length, 0);
  const result = await modelInput('Kxe4', chess, server);
  assert.equal(result.value, 'd3e4');
  assert.equal(result.source, 'notation');
  assert.ok(suggestMoves('Ke4', chess).every(move => move.startsWith('K')));
  assert.ok(suggestMoves('Ke4', chess).length <= 5);
});

test('natural-language suggestions match the requested pawn capture and target', async () => {
  const chess = new Chess();
  chess.play('e4'); chess.play('d5');
  const before = chess.fen();
  assert.deepEqual(suggestMoves('my pawn takes on d5', chess), ['exd5']);
  assert.deepEqual(suggestMoves('my knight takes on d5', chess), []);
  const server = { resolve: async () => { throw new ResolutionError('No match', 422); } };
  await assert.rejects(modelInput('my pawn takes on d5', chess, server), /Try: exd5/);
  assert.equal(chess.fen(), before);
});

test('unrelated requests do not produce random legal suggestions', () => {
  assert.deepEqual(suggestMoves('hello there', new Chess()), []);
});

test('strict SAN does not strip a wrong check marker or annotations', async () => {
  const chess = new Chess();
  await assert.rejects(modelInput('e4+', chess), /Try: e4/);
  await assert.rejects(modelInput('e4!', chess), /Try: e4/);
  assert.equal((await modelInput('e2e4', chess)).value, 'e2e4');
});

test('provider outages remain errors rather than move suggestions', async () => {
  const server = { resolve: async () => { throw new ResolutionError('TypeSafe unavailable', 502); } };
  await assert.rejects(modelInput('move my pawn', new Chess(), server), /TypeSafe unavailable/);
});
