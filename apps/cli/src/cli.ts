import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Chess, START_FEN } from '@chess/chess';
import { modelInput } from './input.js';
import { ChessServerClient } from './api.js';
import { render } from './ui.js';
import { renderGraphics, supportsGraphics, type GraphicsMode } from './graphics.js';
import { engineMove } from './engine.js';
import { GameScreen } from './screen.js';
import { moveHistory, undoTurn } from './history.js';
import type { Key } from 'node:readline';

const HELP = `chess — terminal chess

Usage: chess [--elo 1350] [--color white|black] [--fen FEN]
             [--server URL] [--depth 12] [--graphics auto|kitty|text]

Moves accept UCI (e2e4), SAN (Nf3), or free text ("move the queen up by 1").
Stockfish is included and runs locally. Only free text requires the Chess server.
Commands: fen, fen <position>, undo (Ctrl+U), help, quit`;

export async function run(args:string[]):Promise<void> {
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  const get = (name:string, fallback:string|undefined):string|undefined => { const index = args.indexOf(name); return index < 0 ? fallback : (args[index + 1] ?? fallback); };
  const graphics = get('--graphics', 'auto') as GraphicsMode;
  if (!['auto', 'kitty', 'text'].includes(graphics)) throw new Error('Graphics must be auto, kitty, or text.');
  const useGraphics = supportsGraphics(graphics);
  const elo = Number(get('--elo', '1350'));
  const human = get('--color', 'white')!.toLowerCase().startsWith('b') ? 'b' : 'w';
  const depth = Number(get('--depth', '12'));
  if (!Number.isInteger(elo) || elo < 1320 || elo > 3190) throw new Error('ELO must be an integer from 1320 to 3190 (Stockfish UCI range).');

  if (!Number.isInteger(depth) || depth < 1 || depth > 30) throw new Error('Depth must be an integer from 1 to 30.');

  const chess = new Chess(get('--fen', START_FEN)!);
  const abort = new AbortController();
  const server = new ChessServerClient(get('--server', process.env.CHESS_SERVER_URL || 'http://localhost:8000')!, abort.signal);
  const rl = createInterface({ input: stdin, output: stdout });
  const screen = new GameScreen(Boolean(stdout.isTTY && stdin.isTTY));
  let stopped = false;
  let asking = false;
  let last: number[] | null = null;
  let undoRequested = false;
  let search: AbortController | undefined;
  let notice = 'Enter a move · Ctrl+U undo · help · quit';
  const header = `CHESS · Ctrl+U undo · You are ${human === 'w' ? 'White' : 'Black'} · Stockfish ${elo} ELO`;
  const draw = (): void => screen.draw(header,
    useGraphics ? renderGraphics(chess, human, last, screen.active)
      : render(chess, { perspective: human, last, compact: screen.active && (stdout.rows || 40) < 36 }),
    notice, moveHistory(chess, Math.max(1, (stdout.columns || 80) - 1)));
  const takeBack = (): void => {
    notice = undoTurn(chess, human) ? 'Took back your last move and any Stockfish reply.' : 'No move to undo yet.';
    const move = chess.history.at(-1)?.move;
    last = move ? [move.from, move.to] : null;
  };
  const shortcut = (_text: string, key: Key): void => {
    if (!key?.ctrl || key.name !== 'u' || stopped) return;
    if (asking) {
      rl.write(null, { ctrl: true, name: 'e' });
      rl.write(null, { ctrl: true, name: 'u' });
      rl.write('undo\n');
    } else {
      undoRequested = true;
      search?.abort();
    }
  };
  const stop = (): void => { stopped = true; abort.abort(); search?.abort(); };
  const resize = (): void => {
    if (stopped) return;
    draw();
    if (asking) rl.prompt(true);
  };
  const question = async (prompt: string): Promise<string> => {
    asking = true;
    try { return await rl.question(prompt, { signal: abort.signal }); }
    finally { asking = false; }
  };
  stdin.on('keypress', shortcut);
  rl.on('SIGINT', stop);
  rl.on('close', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  stdout.on('resize', resize);
  screen.open();

  try {
    while (!stopped) {
      const status = chess.status();
      if (status) {
        notice = status;
        draw();
        if (screen.active) {
          const command = await question('Ctrl+U to undo · Enter to exit › ');
          if (command.trim().toLowerCase() === 'undo') { takeBack(); continue; }
        } else console.log(status);
        break;
      }
      if (chess.turn !== human) {
        notice = 'Stockfish is thinking…';
        draw();
        search = new AbortController();
        let move: string;
        try { move = await engineMove(chess.fen(), elo, depth, search.signal); }
        catch (error) {
          if (undoRequested && !stopped) { undoRequested = false; takeBack(); continue; }
          throw error;
        } finally { search = undefined; }
        const side = chess.turn;
        const san = chess.play(move);
        const played = chess.history.at(-1)!.move;
        last = [played.from, played.to];
        notice = `${side === 'w' ? 'White' : 'Black'} plays ${san}`;
        continue;
      }

      draw();
      const raw = await question(`${chess.fullmove}${chess.turn === 'b' ? '…' : '.'} your move › `);
      let intent;
      try { intent = await modelInput(raw, chess, server); }
      catch (error) { notice = undoRequested ? 'Pending move cancelled.' : message(error); undoRequested = false; continue; }
      if (undoRequested) { undoRequested = false; notice = 'Pending move cancelled.'; continue; }
      if (stopped || intent.type === 'quit') break;
      if (intent.type === 'help') { notice = 'e4 / e2e4 / exd5 · Ctrl+U undo · fen · fen <position> · quit'; continue; }
      if (intent.type === 'show-fen') { notice = chess.fen(); continue; }
      if (intent.type === 'load-fen') {
        try { chess.load(intent.value); last = null; notice = 'Position loaded.'; }
        catch (error) { notice = message(error); }
        continue;
      }
      if (intent.type === 'undo') { takeBack(); continue; }
      if (intent.type === 'empty') continue;
      try {
        const san = chess.play(intent.value);
        const move = chess.history.at(-1)!.move;
        last = [move.from, move.to];
        notice = intent.source === 'jev' ? `JEV chose ${san}` : `You played ${san}`;
      } catch (error) {
        notice = `${message(error)}. Try e2e4, Nf3, or describe the move.`;
      }
    }
  } catch (error) {
    if (!stopped) throw error;
  } finally {
    stdin.off('keypress', shortcut);
    stdout.off('resize', resize);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    rl.close();
    screen.close();
  }
}

export { HELP };
const message = (error:unknown):string => error instanceof Error ? error.message : String(error);
