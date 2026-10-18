import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { Chess } from '@zchess/chess';

const require = createRequire(import.meta.url);
const stockfish = require('stockfish') as { findEngine(flavor: string): string };

/** Run the bundled engine in a separate process so search never blocks the CLI. */
export async function engineMove(fen: string, elo: number, depth: number, signal?: AbortSignal): Promise<string> {
  if (!Number.isInteger(elo) || elo < 1320 || elo > 3190) throw new Error('ELO must be an integer from 1320 to 3190.');
  if (!Number.isInteger(depth) || depth < 1 || depth > 30) throw new Error('Depth must be an integer from 1 to 30.');
  signal?.throwIfAborted();
  const position = new Chess(fen);
  if (position.status()) throw new Error('The game is over.');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [stockfish.findEngine('single')], { stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = createInterface({ input: child.stdout });
    let settled = false;
    const finish = (error?: Error, move?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      lines.close();
      child.kill();
      if (error) reject(error);
      else resolve(move!);
    };
    const timer = setTimeout(() => finish(new Error('Stockfish timed out. Try a lower --depth.')), 60_000);
    const cancel = (): void => finish(new Error('Stockfish search cancelled.'));
    signal?.addEventListener('abort', cancel, { once: true });
    child.on('error', error => finish(new Error(`Could not start bundled Stockfish: ${error.message}`)));
    child.stdin.on('error', error => finish(error));
    child.on('exit', () => finish(new Error('Stockfish exited before returning a move.')));
    lines.on('line', line => {
      if (line === 'uciok') {
        child.stdin.write(`setoption name UCI_LimitStrength value true\nsetoption name UCI_Elo value ${elo}\nisready\n`);
      } else if (line === 'readyok') {
        child.stdin.write(`position fen ${fen}\ngo depth ${depth}\n`);
      } else if (line.startsWith('bestmove ')) {
        const move = line.split(/\s+/)[1];
        try {
          position.play(move);
          finish(undefined, move);
        } catch {
          finish(new Error('Stockfish returned an invalid move.'));
        }
      }
    });
    child.stdin.write('uci\n');
  });
}
