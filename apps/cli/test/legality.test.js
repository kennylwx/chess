import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from '@zchess/chess';
import { illegalMoveReason } from '../dist/legality.js';
import { modelInput } from '../dist/input.js';

const pinned = 'k3r3/8/8/8/3p4/8/4N3/4K3 w - - 0 1';

test('explains a pinned piece in SAN, UCI, and plain English without changing the position', async () => {
  for (const input of ['Nc3', 'e2c3', 'move my knight from e2 to c3']) {
    const chess = new Chess(pinned);
    await assert.rejects(modelInput(input, chess), /Knight e2 is pinned by rook e8/);
    assert.equal(chess.fen(), pinned);
    assert.equal(chess.history.length, 0);
  }
});

test('also explains a pinned capture', () => {
  assert.match(illegalMoveReason('Nxd4', new Chess(pinned)), /pinned/);
});

test('does not reject a pinned piece moving along its pin or taking the pinning piece', async () => {
  const chess = new Chess('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.equal(illegalMoveReason('Re3', chess), undefined);
  assert.equal(illegalMoveReason('Rxe8+', chess), undefined);
  assert.equal((await modelInput('e2e3', chess)).type, 'move');
});

test('distinguishes existing check and attacked king destinations from pins', () => {
  const check = new Chess('k3r3/8/8/8/8/8/N7/4K3 w - - 0 1');
  assert.match(illegalMoveReason('Nb4', check), /You are in check/);
  const king = new Chess('k3r3/8/8/8/8/8/8/3K4 w - - 0 1');
  assert.match(illegalMoveReason('Ke1', king), /square is attacked/);
});

test('does not label blocked or unspecified moves as pinned', () => {
  assert.equal(illegalMoveReason('Nc3', new Chess()), undefined);
  assert.equal(illegalMoveReason('move a piece', new Chess(pinned)), undefined);
  assert.equal(illegalMoveReason('Ne8', new Chess(pinned)), undefined);
});
