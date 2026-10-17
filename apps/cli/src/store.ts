import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export interface SavedGame {
  id: number;
  createdAt: string;
  updatedAt: string;
  elo: number;
  color: 'w' | 'b';
  startFen: string;
  fen: string;
  moves: string[];
  status: string;
}

export class GameStore {
  private readonly db: DatabaseSync;

  constructor(path = process.env.CHESS_DB_PATH || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'chess', 'games.sqlite')) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        elo INTEGER NOT NULL,
        color TEXT NOT NULL CHECK (color IN ('w', 'b')),
        start_fen TEXT NOT NULL,
        fen TEXT NOT NULL,
        moves TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
  }

  save(game: Omit<SavedGame, 'id' | 'createdAt' | 'updatedAt'>, id?: number): number {
    const now = new Date().toISOString();
    if (id === undefined) {
      const result = this.db.prepare(`INSERT INTO games (created_at, updated_at, elo, color, start_fen, fen, moves, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(now, now, game.elo, game.color, game.startFen, game.fen, JSON.stringify(game.moves), game.status);
      return Number(result.lastInsertRowid);
    }
    this.db.prepare(`UPDATE games SET updated_at = ?, elo = ?, color = ?, start_fen = ?, fen = ?, moves = ?, status = ? WHERE id = ?`)
      .run(now, game.elo, game.color, game.startFen, game.fen, JSON.stringify(game.moves), game.status, id);
    return id;
  }

  list(): SavedGame[] {
    const rows = this.db.prepare('SELECT * FROM games ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map(row => this.decode(row));
  }

  get(id: number): SavedGame | undefined {
    const row = this.db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.decode(row) : undefined;
  }

  close(): void { this.db.close(); }

  private decode(row: Record<string, unknown>): SavedGame {
    return {
      id: Number(row.id), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      elo: Number(row.elo), color: row.color === 'b' ? 'b' : 'w', startFen: String(row.start_fen), fen: String(row.fen),
      moves: JSON.parse(String(row.moves)) as string[], status: String(row.status),
    };
  }
}
