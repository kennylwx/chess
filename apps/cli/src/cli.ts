import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Chess, START_FEN } from '@chess/chess';
import { modelInput } from './input.js';
import { ChessServerClient } from './api.js';
import { render } from './ui.js';
import { renderGraphics, supportsGraphics, type GraphicsMode } from './graphics.js';
import { engineMove } from './engine.js';
import { GameScreen, MenuScreen } from './screen.js';
import { moveHistory, undoTurn } from './history.js';
import { GameStore, type SavedGame } from './store.js';
import type { Key } from 'node:readline';

const HELP = `chess — terminal chess

Usage: chess [--elo 1500] [--color white|black] [--fen FEN]
             [--server URL] [--depth 12] [--graphics auto|kitty|text]

Run "chess" with no options to open the Play / Load game menu.
Moves accept UCI (e2e4), SAN (Nf3), or free text ("move the queen up by 1").
Stockfish is included and runs locally. Only free text requires the Chess server.
Games are saved automatically in ~/.local/share/chess/games.sqlite.
Commands: fen, fen <position>, undo (Ctrl+U), help, quit`;

const promptColor = '\x1b[38;2;190;221;173m';
const reset = '\x1b[0m';
const ELO_PRESETS = [
  { label: 'Beginner', elo: 1320 },
  { label: 'Intermediate', elo: 1500 },
  { label: 'Advanced', elo: 1800 },
  { label: 'Expert', elo: 2200 },
  { label: 'Master', elo: 3190 },
];
interface GameConfig { elo: number; human: 'w' | 'b'; saved?: SavedGame; fen?: string }

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  const get = (name: string, fallback: string | undefined): string | undefined => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : (args[index + 1] ?? fallback);
  };
  const graphics = get('--graphics', 'auto') as GraphicsMode;
  if (!['auto', 'kitty', 'text'].includes(graphics)) throw new Error('Graphics must be auto, kitty, or text.');
  const depth = Number(get('--depth', '12'));
  if (!Number.isInteger(depth) || depth < 1 || depth > 30) throw new Error('Depth must be an integer from 1 to 30.');
  const store = new GameStore(get('--db', undefined));
  const direct = args.some(arg => arg.startsWith('--'));
  const interactiveMenu = !direct && stdin.isTTY && stdout.isTTY;
  const menuScreen = interactiveMenu ? new MenuScreen(true) : undefined;
  menuScreen?.open();

  try {
    let keepGoing = true;
    let returnToSavedGames = false;
    while (keepGoing) {
      let config: GameConfig | undefined;
      if (direct || !stdin.isTTY || !stdout.isTTY) {
        const elo = Number(get('--elo', '1500'));
        if (!Number.isInteger(elo) || elo < 1320 || elo > 3190) throw new Error('ELO must be an integer from 1320 to 3190 (Stockfish UCI range).');
        config = { elo, human: get('--color', 'white')!.toLowerCase().startsWith('b') ? 'b' : 'w', fen: get('--fen', undefined) };
        keepGoing = false;
      } else {
        const choice = await mainMenu(store, menuScreen!, returnToSavedGames);
        returnToSavedGames = false;
        if (choice === 'quit') break;
        config = choice;
      }
      if (config) {
        const again = await playGame(config, { graphics, depth, serverUrl: get('--server', process.env.CHESS_SERVER_URL || 'http://localhost:8000')!, store, sharedScreen: interactiveMenu });
        if (again && config.saved) returnToSavedGames = true;
        if (direct || !again) keepGoing = false;
      }
    }
  } finally { menuScreen?.close(); store.close(); }
}

async function mainMenu(store: GameStore, screen: MenuScreen, openSavedGames = false): Promise<GameConfig | 'quit'> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      if (openSavedGames) {
        openSavedGames = false;
        const game = await savedGamesMenu(store, screen);
        if (game === 'quit') return 'quit';
        if (game) return game;
        continue;
      }
      screen.draw('CHESS  /  LOCAL STOCKFISH', '  1  Play\n  2  Load a saved game', 'Press 1 or 2 · B back · Q quit');
      const choice = await menuKey('Select › ', ['1', '2', 'b', 'q']);
      if (choice === 'q' || choice === 'b') return 'quit';
      if (choice === '1') {
        const game = await newGameMenu(screen);
        if (game === 'quit') return 'quit';
        if (game) return game;
      }
      if (choice === '2' || choice === 'load') {
        const game = await savedGamesMenu(store, screen);
        if (game === 'quit') return 'quit';
        if (game) return game;
      }
    }
  } finally { rl.close(); }
}

async function savedGamesMenu(store: GameStore, screen: MenuScreen): Promise<GameConfig | 'quit' | null> {
  const games = store.list();
  if (!games.length) {
    screen.draw('LOAD A SAVED GAME', 'No saved games yet.', 'B back · Q quit');
    const action = await menuKey('Select › ', ['b', 'q']);
    return action === 'q' ? 'quit' : null;
  }
  const recent = games.slice(0, 9);
  const lines = recent.map((game, index) => `  ${index + 1}  ${game.updatedAt.slice(0, 16).replace('T', ' ')} · ${game.elo} ELO · ${game.moves.length ? game.moves.join(' ') : 'New game'} · ${game.status}`);
  if (games.length > recent.length) lines.push('  Showing the 9 most recent games.');
  screen.draw('LOAD A SAVED GAME', lines.join('\n'), 'Press a game number · B back · Q quit');
  const selection = await menuKey('Choose a game › ', [...recent.map((_, index) => String(index + 1)), 'b', 'q']);
  if (selection === 'q') return 'quit';
  if (selection === 'b') return null;
  const game = recent[Number(selection) - 1];
  return game ? { elo: game.elo, human: game.color, saved: game } : null;
}

async function newGameMenu(screen: MenuScreen): Promise<GameConfig | null | 'quit'> {
  const choices = ELO_PRESETS.map(({ label, elo }, index) => `  ${index + 1}  ${label} · ${elo} ELO`);
  choices.push('  6  Custom ELO');
  screen.draw('NEW GAME  /  STOCKFISH STRENGTH', `${choices.join('\n')}\n\nAvailable range: 1320–3190 ELO`, 'Press 1–6 · B back · Q quit');
  const selection = await menuKey('ELO › ', ['1', '2', '3', '4', '5', '6', 'b', 'q']);
  if (selection === 'q') return 'quit';
  if (selection === 'b') return null;
  let elo = ELO_PRESETS[Number(selection) - 1]?.elo;
  if (selection === '6') {
    let custom: number;
    while (true) {
      screen.draw('NEW GAME  /  CUSTOM ELO', 'Enter any ELO from 1320 to 3190.', 'Enter applies · B back · Q quit');
      const value = await menuText('ELO › ');
      if (value === 'q') return 'quit';
      if (value === 'b' || value === null) return await newGameMenu(screen);
      custom = Number(value);
      if (Number.isInteger(custom) && custom >= 1320 && custom <= 3190) break;
      screen.draw('NEW GAME  /  CUSTOM ELO', 'Enter any ELO from 1320 to 3190.\nThat value is outside the available range.', 'Enter applies · B back · Q quit');
    }
    elo = custom;
  }
  if (elo === undefined) return null;
  while (true) {
    screen.draw('NEW GAME  /  CHOOSE SIDE', `Stockfish ${elo} ELO\n\n  1  White\n  2  Black\n  3  Random`, 'Press 1, 2, 3 · B back · Q quit');
    const side = await menuKey('Side › ', ['1', '2', '3', 'b', 'q']);
    if (side === 'q') return 'quit';
    if (side === 'b') return await newGameMenu(screen);
    const human: 'w' | 'b' = side === '1' ? 'w' : side === '2' ? 'b' : Math.random() < 0.5 ? 'w' : 'b';
    return { elo, human };
  }
}

function menuKey(prompt: string, choices: string[]): Promise<string> {
  return rawPrompt(prompt, (text, key, finish) => {
    if (key?.name === 'escape') { finish('b'); return; }
    if (key?.ctrl && key.name === 'c') { finish('q'); return; }
    const character = (text ?? '').toLowerCase();
    if (!key?.ctrl && choices.includes(character)) finish(character);
  });
}

function menuText(prompt: string): Promise<string | 'b' | 'q' | null> {
  let value = '';
  return rawPrompt(prompt, (text, key, finish) => {
    if (key?.name === 'escape') { finish('b'); return; }
    if (key?.ctrl && key.name === 'c') { finish('q'); return; }
    if (key?.name === 'backspace') {
      value = value.slice(0, -1);
      stdout.write('\b \b');
      return;
    }
    if (key?.name === 'return' || key?.name === 'enter') { finish(value); return; }
    const character = text ?? '';
    if (key?.ctrl || !character) return;
    if (character.toLowerCase() === 'b') { finish('b'); return; }
    if (character.toLowerCase() === 'q') { finish('q'); return; }
    value += character;
    stdout.write(character);
  });
}

function rawPrompt<T>(prompt: string, onKey: (text: string, key: Key, finish: (value: T) => void) => void): Promise<T> {
  const stream = stdin as typeof stdin & { setRawMode?: (mode: boolean) => void };
  if (!stream.isTTY || !stream.setRawMode) return Promise.reject(new Error('Menu selection requires an interactive terminal.'));
  const previous = stdin.listeners('keypress') as Array<(...args: any[]) => void>;
  previous.forEach(listener => stdin.removeListener('keypress', listener));
  stdout.write(`${promptColor}${prompt}${reset}`);
  stream.setRawMode(true);
  return new Promise(resolve => {
    let finished = false;
    const finish = (value: T): void => {
      if (finished) return;
      finished = true;
      stdin.removeListener('keypress', listener);
      stream.setRawMode(false);
      [...previous].reverse().forEach(listener => stdin.prependListener('keypress', listener));
      stdout.write('\r\n');
      resolve(value);
    };
    const listener = (text: string, key: Key): void => onKey(text, key, finish);
    stdin.on('keypress', listener);
  });
}

async function playGame(config: GameConfig, options: { graphics: GraphicsMode; depth: number; serverUrl: string; store: GameStore; sharedScreen: boolean }): Promise<boolean> {
  const { elo, human, saved } = config;
  let startFen = saved?.startFen ?? config.fen ?? START_FEN;
  const chess = new Chess(startFen);
  if (saved) for (const move of saved.moves) chess.play(move);
  const abort = new AbortController();
  const server = new ChessServerClient(options.serverUrl, abort.signal);
  const rl = createInterface({ input: stdin, output: stdout });
  const screen = new GameScreen(Boolean(stdout.isTTY && stdin.isTTY), stdout, !options.sharedScreen);
  const useGraphics = supportsGraphics(options.graphics);
  let stopped = false;
  let asking = false;
  let redrawInput: (() => void) | undefined;
  let last: number[] | null = null;
  let undoRequested = false;
  let returnToMenu = false;
  let returnToMenuRequested = false;
  let search: AbortController | undefined;
  let typedCommand = '';
  let backTimer: ReturnType<typeof setTimeout> | undefined;
  let quitTimer: ReturnType<typeof setTimeout> | undefined;
  let notice = 'Enter a move';
  let gameId = saved?.id;
  const header = `CHESS  /  ${human === 'w' ? 'White' : 'Black'}  /  Stockfish ${elo} ELO`;
  const persist = (): void => {
    gameId = options.store.save({ elo, color: human, startFen, fen: chess.fen(), moves: chess.history.map(entry => entry.san), status: chess.status() ?? 'In progress' }, gameId);
  };
  const draw = (): void => screen.draw(header,
    useGraphics ? renderGraphics(chess, human, last, screen.active)
      : render(chess, { perspective: human, last, compact: screen.active && (stdout.rows || 40) < 36 }),
    notice, moveHistory(chess, Math.max(1, (stdout.columns || 80) - 1)));
  const takeBack = (): void => {
    notice = undoTurn(chess, human) ? 'Took back your last move and any Stockfish reply.' : 'No move to undo yet.';
    const move = chess.history.at(-1)?.move;
    last = move ? [move.from, move.to] : null;
    persist();
  };
  const shortcut = (text: string, key: Key): void => {
    if (stopped || returnToMenuRequested) return;
    const goBack = (): void => {
      returnToMenuRequested = true;
      abort.abort();
      search?.abort();
    };
    if (key?.name === 'escape') { goBack(); return; }
    if (key?.ctrl && key.name === 'c' || text?.toLowerCase() === 'q' && !asking) { stop(); return; }
    if (key?.name === 'return' || key?.name === 'enter') {
      typedCommand = '';
      if (backTimer) clearTimeout(backTimer);
      if (quitTimer) clearTimeout(quitTimer);
    } else if (key?.name === 'backspace') {
      typedCommand = typedCommand.slice(0, -1);
      if (backTimer) clearTimeout(backTimer);
      if (quitTimer) clearTimeout(quitTimer);
    } else if (!key?.ctrl && text) {
      if (backTimer) clearTimeout(backTimer);
      if (quitTimer) clearTimeout(quitTimer);
      if (!typedCommand && text.toLowerCase() === 'b') {
        typedCommand = 'b';
        if (!asking) { goBack(); return; }
        backTimer = setTimeout(() => { if (typedCommand === 'b') goBack(); }, 300);
        return;
      }
      if (!typedCommand && text.toLowerCase() === 'q') {
        typedCommand = 'q';
        quitTimer = setTimeout(() => { if (typedCommand === 'q') stop(); }, 300);
        return;
      }
      typedCommand += text;
      if (typedCommand.trim().toLowerCase() === 'back') { goBack(); return; }
      if (typedCommand.trim().toLowerCase() === 'quit') { stop(); return; }
    }
    if (!key?.ctrl || key.name !== 'u') return;
    if (asking) {
      typedCommand = '';
      rl.write(null, { ctrl: true, name: 'e' });
      rl.write(null, { ctrl: true, name: 'u' });
      rl.write('undo\n');
    } else { undoRequested = true; search?.abort(); }
  };
  const stop = (): void => { stopped = true; abort.abort(); search?.abort(); if (backTimer) clearTimeout(backTimer); if (quitTimer) clearTimeout(quitTimer); };
  const resize = (): void => { if (!stopped) { draw(); redrawInput?.(); } };
  const question = async (placeholder: string): Promise<string> => {
    asking = true;
    if (!screen.active) {
      try { return await rl.question(`${promptColor}${placeholder} › ${reset}`, { signal: abort.signal }); }
      finally { asking = false; }
    }
    const stream = stdin as typeof stdin & { setRawMode?: (mode: boolean) => void };
    const previousRaw = stream.isRaw;
    const previous = stdin.listeners('keypress') as Array<(text: string, key: Key) => void>;
    previous.forEach(listener => stdin.removeListener('keypress', listener));
    stream.setRawMode?.(true);
    return new Promise(resolve => {
      let value = '';
      let done = false;
      let shortcutTimer: ReturnType<typeof setTimeout> | undefined;
      const redraw = (): void => screen.input(value, placeholder);
      const finish = (answer: string): void => {
        if (done) return;
        done = true;
        if (shortcutTimer) clearTimeout(shortcutTimer);
        stdin.removeListener('keypress', onKey);
        abort.signal.removeEventListener('abort', onAbort);
        previous.forEach(listener => stdin.on('keypress', listener));
        stream.setRawMode?.(previousRaw);
        redrawInput = undefined;
        asking = false;
        screen.input('', placeholder);
        resolve(answer);
      };
      const onAbort = (): void => finish('');
      const onKey = (text: string, key: Key): void => {
        if (shortcutTimer) { clearTimeout(shortcutTimer); shortcutTimer = undefined; }
        if (key?.name === 'escape') { returnToMenuRequested = true; abort.abort(); search?.abort(); finish(''); return; }
        if (key?.ctrl && key.name === 'c') { stop(); finish(''); return; }
        if (key?.ctrl && key.name === 'u') { finish('undo'); return; }
        if (key?.name === 'return' || key?.name === 'enter') { finish(value); return; }
        if (key?.name === 'backspace') value = [...value].slice(0, -1).join('');
        else if (!key?.ctrl && !key?.meta && text && !/[\x00-\x1f\x7f]/.test(text)) value += text;
        redraw();
        if (value.toLowerCase() === 'b' || value.toLowerCase() === 'q') {
          shortcutTimer = setTimeout(() => {
            if (value.toLowerCase() === 'b') { returnToMenuRequested = true; abort.abort(); search?.abort(); finish(''); }
            else { stop(); finish(''); }
          }, 300);
        }
      };
      redrawInput = redraw;
      stdin.on('keypress', onKey);
      abort.signal.addEventListener('abort', onAbort, { once: true });
      redraw();
    });
  };
  stdin.on('keypress', shortcut);
  rl.on('SIGINT', stop);
  rl.on('close', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  stdout.on('resize', resize);
  screen.open();
  persist();

  try {
    while (!stopped && !returnToMenuRequested) {
      const status = chess.status();
      if (status) {
        notice = status;
        persist();
        draw();
        if (screen.active) {
          const command = await question('B menu · Q quit · Ctrl+U undo');
          if (command.trim().toLowerCase() === 'undo') { takeBack(); continue; }
          if (/^(q|quit|exit)$/.test(command.trim().toLowerCase())) { stop(); break; }
          break;
        }
        console.log(status);
        break;
      }
      if (chess.turn !== human) {
        notice = 'Stockfish is thinking…';
        draw();
        search = new AbortController();
        let move: string;
        try { move = await engineMove(chess.fen(), elo, options.depth, search.signal); }
        catch (error) {
          if (returnToMenuRequested) break;
          if (undoRequested && !stopped) { undoRequested = false; takeBack(); continue; }
          throw error;
        } finally { search = undefined; }
        const side = chess.turn;
        const san = chess.play(move);
        const played = chess.history.at(-1)!.move;
        last = [played.from, played.to];
        notice = `${side === 'w' ? 'White' : 'Black'} plays ${san}`;
        persist();
        continue;
      }

      draw();
      let raw: string;
      try { raw = await question('free text'); }
      catch (error) { if (returnToMenuRequested) break; throw error; }
      let intent;
      try { intent = await modelInput(raw, chess, server); }
      catch (error) { notice = undoRequested ? 'Pending move cancelled.' : message(error); undoRequested = false; continue; }
      if (undoRequested) { undoRequested = false; notice = 'Pending move cancelled.'; continue; }
      if (stopped) break;
      if (intent.type === 'quit') { stop(); break; }
      if (intent.type === 'help') { notice = 'e4 / e2e4 / exd5 · Ctrl+U undo · fen · fen <position> · quit'; continue; }
      if (intent.type === 'show-fen') { notice = chess.fen(); continue; }
      if (intent.type === 'load-fen') {
        try { chess.load(intent.value); startFen = intent.value; last = null; notice = 'Position loaded.'; persist(); }
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
        persist();
      } catch (error) { notice = `${message(error)}. Try e2e4, Nf3, or describe the move.`; }
    }
  } catch (error) { if (!stopped) throw error; }
  finally {
    returnToMenu = screen.active && !stopped;
    stdin.off('keypress', shortcut);
    stdout.off('resize', resize);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    rl.close();
    screen.close();
  }
  return returnToMenu || screen.active && returnToMenuRequested;
}

export { HELP };
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
