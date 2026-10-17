import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { GameStore } from '../dist/store.js';

test('saves games in SQLite and reloads their move history and current position', () => {
  const directory = mkdtempSync(join(tmpdir(), 'chess-store-'));
  const path = join(directory, 'games.sqlite');
  try {
    let store = new GameStore(path);
    const id = store.save({
      elo: 1500,
      color: 'w',
      startFen: 'start',
      fen: 'after e4',
      moves: ['e4', 'e5'],
      status: 'In progress',
    });
    store.save({
      elo: 1500,
      color: 'w',
      startFen: 'start',
      fen: 'after Nf3',
      moves: ['e4', 'e5', 'Nf3'],
      status: 'In progress',
    }, id);
    store.close();

    store = new GameStore(path);
    const saved = store.get(id);
    assert.equal(saved?.fen, 'after Nf3');
    assert.deepEqual(saved?.moves, ['e4', 'e5', 'Nf3']);
    assert.equal(store.list()[0]?.id, id);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
