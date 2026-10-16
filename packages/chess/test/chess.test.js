import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../dist/index.js';
test('plays legal moves and exports FEN',()=>{const chess=new Chess();assert.equal(chess.moves().length,20);assert.equal(chess.play('e2e4'),'e4');assert.match(chess.fen(),/4P3/);});
test('detects checkmate',()=>{const chess=new Chess();for(const move of ['f3','e5','g4','Qh4#'])chess.play(move);assert.equal(chess.status(),'Black wins by checkmate');});
