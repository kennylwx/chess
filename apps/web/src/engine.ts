import { Chess } from '@zchess/chess';

export function engineMove(fen: string, elo: number, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!Number.isInteger(elo) || elo < 1320 || elo > 3190) throw new Error('Choose an ELO from 1320 to 3190.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
    let settled = false;
    const finish = (error?: Error, move?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) reject(error); else resolve(move!);
    };
    const cancel = (): void => finish(new DOMException('Search cancelled', 'AbortError'));
    const timer = window.setTimeout(() => finish(new Error('Stockfish timed out. Retry or undo your move.')), 60_000);
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = () => finish(new Error('Stockfish could not start. Retry or reload the page.'));
    worker.onmessage = event => {
      for (const line of String(event.data).split('\n')) {
        if (line === 'uciok') {
          worker.postMessage('setoption name UCI_LimitStrength value true');
          worker.postMessage(`setoption name UCI_Elo value ${elo}`);
          worker.postMessage('isready');
        } else if (line === 'readyok') {
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage('go depth 12');
        } else if (line.startsWith('bestmove ')) {
          const move = line.split(/\s+/)[1];
          try { new Chess(fen).play(move); finish(undefined, move); }
          catch { finish(new Error('Stockfish returned an invalid move. Retry or undo.')); }
        }
      }
    };
    worker.postMessage('uci');
  });
}
