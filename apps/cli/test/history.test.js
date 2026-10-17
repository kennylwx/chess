import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess, START_FEN } from '@chess/chess';
import { moveHistory, undoTurn } from '../dist/history.js';

test('shows numbered SAN in a single row and updates after undo', () => {
  const chess = new Chess();
  for (const move of ['e4', 'e5', 'Nf3', 'Nc6']) chess.play(move);
  assert.equal(moveHistory(chess), 'Moves: 1. e4 e5 2. Nf3 Nc6');
  assert.equal(undoTurn(chess, 'w'), true);
  assert.equal(moveHistory(chess), 'Moves: 1. e4 e5');
  assert.equal(chess.turn, 'w');
});

test('undo works before the engine replies and does not remove an opponent-only opening', () => {
  const chess = new Chess();
  chess.play('e4');
  const afterWhite = chess.fen();
  assert.equal(undoTurn(chess, 'b'), false);
  assert.equal(chess.fen(), afterWhite);
  assert.equal(undoTurn(chess, 'w'), true);
  assert.equal(chess.fen(), START_FEN);
  assert.equal(undoTurn(chess, 'w'), false);
});

test('history keeps the latest complete turns on narrow terminals', () => {
  const chess = new Chess();
  for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']) chess.play(move);
  assert.equal(moveHistory(chess, 24), 'Moves: … 3. Bb5 a6');
});

test('FEN numbering and black-first histories remain accurate', () => {
  const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 17');
  chess.play('e5');
  chess.play('Nf3');
  assert.equal(moveHistory(chess), 'Moves: 17… e5 18. Nf3');
  assert.equal(undoTurn(chess, 'b'), true);
  assert.equal(chess.fullmove, 17);
});
