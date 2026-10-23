import { Chess, START_FEN, squareName, type Move } from '@zchess/chess';
import { illegalMoveReason, moveHistory, modelInput, suggestMoves, undoTurn, type InputIntent } from '@zchess/chess/interaction';
import piecePaths from '@zchess/chess/pieces';
import { engineMove } from './engine.js';

declare global { interface ImportMeta { readonly env: Record<string, string | undefined> } }
const API = import.meta.env.VITE_ZCHESS_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
let chess = new Chess();
let human: 'w' | 'b' = 'w';
let busy = false;
let phase: 'resolve' | 'engine' | null = null;
let controller: AbortController | undefined;
let gameVersion = 0;
let last: Move[] = [];
let selected: number | null = null;
let failedFen: string | null = null;
let elo = 1500;
let startFen = START_FEN;
let savedId: string | null = null;
let selectedStrength = 1;
let selectedSide: 'w' | 'b' | 'random' = 'w';
let currentPage: 'home' | 'setup' | 'side' | 'load' | 'game' | 'exit' = 'home';
interface SavedGame { id: string; updatedAt: string; elo: number; color: 'w' | 'b'; startFen: string; moves: string[] }
const STORAGE_KEY = 'zchess.savedGames.v1';
const LEGACY_STORAGE_KEY = 'chess.savedGames.v1';
const strengths = [
  ['Beginner', 1320], ['Intermediate', 1500], ['Advanced', 1800],
  ['Expert', 2200], ['Master', 3190], ['Custom ELO', null],
] as const;
function readGames(): SavedGame[] {
  try {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      saved = localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]';
      if (saved !== '[]') localStorage.setItem(STORAGE_KEY, saved);
    }
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((game): game is SavedGame =>
      typeof game?.id === 'string' && typeof game?.startFen === 'string' && Array.isArray(game?.moves)) : [];
  } catch { return []; }
}
function saveGame(): void {
  if (!savedId) return;
  const game: SavedGame = { id: savedId, updatedAt: new Date().toISOString(), elo, color: human, startFen, moves: chess.history.map(entry => entry.san) };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([game, ...readGames().filter(item => item.id !== savedId)].slice(0, 30))); }
  catch { /* The game remains playable if browser storage is unavailable. */ }
}
function showPage(page: typeof currentPage): void {
  currentPage = page;
  $('menu').hidden = page === 'game';
  $('game').hidden = page !== 'game';
  for (const name of ['home', 'setup', 'side', 'load', 'exit']) $(`menu-${name}`).hidden = page !== name;
  $('menu-hint').textContent = ({ home: 'Press 1 or 2 · B back · Q quit', setup: 'Press 1–6 · B back · Q quit', side: 'Press 1, 2, 3 · B back · Q quit', load: 'Press a game number · B back · Q quit', game: '', exit: 'Press Enter to reopen chess' })[page];
  if (page === 'load') renderSavedGames();
  if (page === 'game') { render(); $('command').focus(); }
}
function renderSavedGames(): void {
  const games = readGames().slice(0, 9);
  const container = $('saved-games');
  container.replaceChildren();
  if (!games.length) { const empty = document.createElement('p'); empty.textContent = 'No saved games yet.'; container.append(empty); return; }
  for (const [index, game] of games.entries()) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'saved-game';
    button.textContent = `${index + 1}  ${new Date(game.updatedAt).toLocaleString()} · ${game.elo} ELO · ${game.color === 'w' ? 'White' : 'Black'} · ${game.moves.length ? game.moves.join(' ') : 'New game'}`;
    button.addEventListener('click', () => loadGame(game));
    container.append(button);
  }
}
function loadGame(game: SavedGame): void {
  try {
    const loaded = new Chess(game.startFen);
    for (const move of game.moves) loaded.play(move);
    gameVersion++; controller?.abort(); controller = undefined; busy = false; phase = null;
    chess = loaded; human = game.color; elo = game.elo; startFen = game.startFen; savedId = game.id;
    last = chess.history.length ? [chess.history.at(-1)!.move] : [];
    selected = null; failedFen = null; message('Saved game loaded.'); showPage('game');
    if (!chess.status() && chess.turn !== human) void playEngine(gameVersion);
  } catch { message('This saved game could not be loaded.', true); }
}
function drawStrengths(): void {
  const container = $('strengths'); container.replaceChildren();
  strengths.forEach(([label, rating], index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = selectedStrength === index ? 'selected' : '';
    button.setAttribute('aria-pressed', String(selectedStrength === index));
    button.innerHTML = `<span class="option-number">${index + 1}</span><strong>${label}</strong>${rating ? `<span class="rating">${rating} ELO</span>` : ''}`;
    button.addEventListener('click', () => chooseStrength(index));
    container.append(button);
  });
}
function chooseStrength(index: number): void {
  selectedStrength = index; drawStrengths();
  $('custom-elo-label').hidden = index !== 5;
  if (index === 5) { $<HTMLInputElement>('custom-elo').focus(); return; }
  elo = strengths[index][1]!; showPage('side');
}
function chooseSide(side: typeof selectedSide): void {
  selectedSide = side; drawSides(); resetGame();
}
function drawSides(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button => {
    const active = button.dataset.side === selectedSide;
    button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
  });
}

function squareColor(index: number): string { return (Math.floor(index / 8) + index % 8) % 2 ? '#64916d' : '#d5e5cb'; }
function board(): string {
  const ranks = human === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const files = human === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768" role="grid" aria-label="Chess board"><rect width="768" height="768" rx="12" fill="#14291f"/>';
  for (const [y, rank] of ranks.entries()) {
    for (const [x, file] of files.entries()) {
      const index = rank * 8 + file, left = 24 + x * 90, top = 24 + y * 90;
      const piece = chess.board[index], movable = selected !== null && chess.moves().some(move => move.from === selected && move.to === index);
      const fill = last.some(move => move.from === index || move.to === index) ? '#b4cf68' : selected === index ? '#d3c66b' : squareColor(index);
      const name = squareName(index);
      svg += `<g role="gridcell" aria-label="${name}${piece ? ` ${pieceName(piece)}` : ''}${movable ? ', legal move' : ''}" data-square="${name}" tabindex="0">`;
      svg += `<rect x="${left}" y="${top}" width="90" height="90" fill="${fill}"/>`;
      if (movable) svg += `<circle cx="${left+45}" cy="${top+45}" r="${piece ? 40 : 9}" fill="${piece ? 'none' : '#23432c'}" fill-opacity="${piece ? 1 : .36}" stroke="${piece ? '#23432c' : 'none'}" stroke-opacity=".7" stroke-width="5"/>`;
      if (piece) svg += `<g class="piece" data-piece="${piece}" transform="translate(${left} ${top}) scale(2)">${piecePaths[piece]}</g>`;
      svg += '</g>';
    }
    svg += `<text x="12" y="${24 + y * 90 + 50}" text-anchor="middle" class="coordinate">${8-rank}</text>`;
  }
  for (const [x, file] of files.entries()) svg += `<text x="${24 + x * 90 + 45}" y="762" text-anchor="middle" class="coordinate">${'abcdefgh'[file]}</text>`;
  return `${svg}</svg>`;
}
function pieceName(piece: string): string { return ({K:'white king',Q:'white queen',R:'white rook',B:'white bishop',N:'white knight',P:'white pawn',k:'black king',q:'black queen',r:'black rook',b:'black bishop',n:'black knight',p:'black pawn'} as Record<string,string>)[piece]; }
function render(): void {
  $('board').innerHTML = board();
  $('board').setAttribute('aria-busy', String(busy));
  $('moves').textContent = moveHistory(chess, Number.MAX_SAFE_INTEGER);
  $('moves').scrollLeft = $('moves').scrollWidth;
  $('turn').textContent = chess.status() || (chess.turn === human ? 'YOUR MOVE' : 'STOCKFISH TO MOVE');
  $('player').textContent = `YOU ARE ${human === 'w' ? 'WHITE' : 'BLACK'}`;
  $('game-label').textContent = `${human === 'w' ? 'White' : 'Black'} / Stockfish ${elo} ELO`;
  $('command').toggleAttribute('disabled', busy || Boolean(chess.status()));
  $('submit').toggleAttribute('disabled', busy || Boolean(chess.status()));
  $('undo').toggleAttribute('disabled', !busy && !chess.history.some(entry => entry.before.turn === human));
  $('retry').hidden = failedFen === null || busy;
  document.querySelector('.feedback')?.classList.toggle('error', $('output').dataset.error === 'true');
}
function message(text: string, error = false, suggestions: string[] = []): void {
  $('output').textContent = text;
  $('output').dataset.error = String(error);
  const area = $('suggestions');
  area.replaceChildren(...suggestions.slice(0, 5).map(san => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = san; button.setAttribute('aria-label', `Play suggested move ${san}`);
    button.addEventListener('click', () => { ($('command') as HTMLInputElement).value = san; $<HTMLFormElement>('command-form').requestSubmit(); });
    return button;
  }));
}
function runSuggestions(input: string): string[] {
  const found = suggestMoves(input, chess);
  return found.length ? found : [];
}
function takeBack(): void {
  const wasEngine = phase === 'engine';
  gameVersion++;
  controller?.abort(); controller = undefined;
  if (wasEngine || !busy) {
    if (undoTurn(chess, human)) message('Took back your last move and Stockfish reply.');
    else message('There is no move to undo yet.');
    last = chess.history.length ? [chess.history.at(-1)!.move] : [];
    saveGame();
  } else message('Cancelled the pending move.');
  busy = false; phase = null; selected = null; failedFen = null; render(); $('command').focus();
}
function setMove(move: string): string {
  const before = chess.history.length;
  const san = chess.play(move);
  last = chess.history.slice(before).map(entry => entry.move);
  selected = null;
  saveGame();
  return san;
}
async function playEngine(version: number): Promise<void> {
  const fen = chess.fen();
  failedFen = null; phase = 'engine'; busy = true; controller = new AbortController();
  message('Stockfish is thinking…'); render();
  try {
    const move = await engineMove(fen, elo, controller.signal);
    if (version !== gameVersion || chess.fen() !== fen) return;
    const san = setMove(move);
    message(`Stockfish played ${san}${chess.status() ? ` · ${chess.status()}` : ''}`);
  } catch (error) {
    if (version !== gameVersion) return;
    failedFen = fen;
    message(error instanceof Error ? error.message : String(error), true);
  } finally {
    if (version === gameVersion) { busy = false; phase = null; controller = undefined; render(); }
  }
}
async function executeMove(intent: Extract<InputIntent, {type:'move'}>, version: number): Promise<void> {
  const san = setMove(intent.value);
  message(intent.source === 'jev' ? `JEV selected ${san}.` : `You played ${san}.`);
  if (chess.status()) { message(`You played ${san} · ${chess.status()}`); return; }
  if (chess.turn !== human) await playEngine(version);
}
async function submitCommand(raw: string): Promise<void> {
  const input = raw.trim(); if (!input || busy) return;
  const lower = input.toLowerCase();
  if (lower === '/help') { message('Commands: /help, /undo, /fen, /fen <position>, /back, /quit. Plain text is treated as a move.'); return; }
  if (lower === '/quit' || lower === '/exit') { gameVersion++; controller?.abort(); busy = false; showPage('exit'); return; }
  if (lower === '/back' || lower === '/menu') { gameVersion++; controller?.abort(); busy = false; showPage('home'); return; }
  if (lower === '/undo') { takeBack(); return; }
  if (lower === '/fen' || lower === '/position') { message(chess.fen()); return; }
  if (/^\/(fen|position)\s+/.test(lower)) {
    try { chess.load(input.replace(/^\/(?:fen|position)\s+/i, '').trim()); startFen = chess.fen(); last=[]; selected=null; saveGame(); message('Position loaded.'); }
    catch { message('Invalid FEN position.', true); }
    render(); return;
  }
  const version = ++gameVersion; busy = true; phase = 'resolve'; controller = new AbortController(); message('Checking your move…'); render();
  try {
    const intent: InputIntent = await modelInput(input, chess, { resolve: async (text, position) => {
      if (!API) throw new Error('Plain-English moves need a Chess server. Use notation such as e4 or e2e4.');
      const response = await fetch(`${API}/api/resolve`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({instruction:text,fen:position.fen()}), signal:controller?.signal });
      const result = await response.json().catch(() => ({})) as {move?:string;fen?:string;explanation?:string;detail?:string};
      if (!response.ok) throw new Error(result.detail || `Chess server returned ${response.status}.`);
      return { move: result.move || '', fen: result.fen || '', explanation: result.explanation || '' };
    } });
    if (version !== gameVersion) return;
    if (intent.type === 'undo') { busy = false; phase = null; takeBack(); return; }
    if (intent.type === 'show-fen') { busy=false; phase=null; message(chess.fen()); render(); return; }
    if (intent.type === 'help') { busy=false; phase=null; message('Commands: /help, /undo, /fen, /fen <position>, /back, /quit. Plain text is treated as a move.'); render(); return; }
    if (intent.type === 'back') { busy=false; phase=null; gameVersion++; showPage('home'); return; }
    if (intent.type !== 'move') { busy=false; phase=null; render(); return; }
    await executeMove(intent, version);
  } catch (error) {
    if (version !== gameVersion) return;
    const text = error instanceof Error ? error.message : String(error);
    const pinned = illegalMoveReason(input, chess);
    message(pinned || text, true, runSuggestions(input));
  } finally {
    if (version === gameVersion) { busy=false; phase=null; controller=undefined; render(); }
  }
}
function resetGame(): void {
  gameVersion++; controller?.abort(); controller=undefined; busy=false; phase=null;
  chess = new Chess(); startFen = START_FEN; last=[]; selected=null; failedFen=null;
  human = selectedSide === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : selectedSide;
  savedId = crypto.randomUUID(); saveGame();
  message('New game.'); showPage('game');
  if (human === 'b') void playEngine(gameVersion);
}
function selectSquare(name: string): void {
  if (busy || chess.status()) return;
  const index = chess.board.findIndex((_, i) => squareName(i) === name);
  if (index < 0) return;
  if (selected !== null && chess.moves().some(move => move.from === selected && move.to === index)) {
    const san = chess.san(chess.moves().find(move => move.from === selected && move.to === index)!, chess.moves());
    void submitCommand(san); return;
  }
  selected = chess.board[index] && (chess.board[index] === chess.board[index]!.toUpperCase()) === (chess.turn === 'w') ? index : null;
  render();
}
$('command-form').addEventListener('submit', event => { event.preventDefault(); const control=$('command') as HTMLInputElement; const value=control.value; control.value=''; void submitCommand(value); });
$('board').addEventListener('click', event => { const target=(event.target as Element).closest<SVGGElement>('[data-square]'); if (target) selectSquare(target.dataset.square!); });
$('board').addEventListener('keydown', event => { const key=event as KeyboardEvent; if (key.key==='Enter' || key.key===' ') { const target=(key.target as Element).closest<SVGGElement>('[data-square]'); if(target){key.preventDefault();selectSquare(target.dataset.square!);} } });
$('undo').addEventListener('click', takeBack);
$('menu-button').addEventListener('click', () => { gameVersion++; controller?.abort(); busy = false; showPage('home'); });
$('play').addEventListener('click', () => showPage('setup'));
$('load').addEventListener('click', () => showPage('load'));
$('reopen').addEventListener('click', () => showPage('home'));
document.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.back as 'home' | 'setup')));
$('next').addEventListener('click', () => {
  const rating = selectedStrength === 5 ? Number($<HTMLInputElement>('custom-elo').value) : (strengths[selectedStrength]?.[1] ?? null);
  if (rating === null || !Number.isInteger(rating) || rating < 1320 || rating > 3190) { $<HTMLInputElement>('custom-elo').reportValidity(); return; }
  elo = rating; showPage('side');
});
document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button => button.addEventListener('click', () => chooseSide(button.dataset.side as typeof selectedSide)));
$('start').addEventListener('click', resetGame);
$('retry').addEventListener('click', () => { if (failedFen && failedFen === chess.fen()) void playEngine(gameVersion); });
$('help').addEventListener('click', () => message('Commands: /help, /undo, /fen, /fen <position>, /back, /quit. Plain text is treated as a move.'));
document.addEventListener('keydown', event => {
  if (currentPage === 'game') {
    if (event.key === 'Escape') { event.preventDefault(); gameVersion++; controller?.abort(); busy = false; showPage('home'); }
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.target === $('custom-elo')) {
    if (key === 'enter') { event.preventDefault(); $('next').click(); }
    if (key === 'escape') { event.preventDefault(); $('custom-elo-label').hidden = true; ($('strengths') as HTMLElement).focus(); }
    return;
  }
  if (currentPage === 'exit') { if (key === 'enter') { event.preventDefault(); showPage('home'); } return; }
  if (key === 'q') { event.preventDefault(); showPage('exit'); return; }
  if (key === 'b' || key === 'escape') { event.preventDefault(); showPage(currentPage === 'side' ? 'setup' : 'home'); return; }
  if (currentPage === 'home' && key === '1') { event.preventDefault(); showPage('setup'); }
  else if (currentPage === 'home' && key === '2') { event.preventDefault(); showPage('load'); }
  else if (currentPage === 'setup' && /^[1-6]$/.test(key)) { event.preventDefault(); chooseStrength(Number(key) - 1); }
  else if (currentPage === 'setup' && key === 'enter') { event.preventDefault(); chooseStrength(selectedStrength); }
  else if (currentPage === 'side' && /^[1-3]$/.test(key)) { event.preventDefault(); chooseSide((['w', 'b', 'random'] as const)[Number(key) - 1]); }
  else if (currentPage === 'side' && key === 'enter') { event.preventDefault(); resetGame(); }
  else if (currentPage === 'load' && /^[1-9]$/.test(key)) {
    const game = readGames().slice(0, 9)[Number(key) - 1];
    if (game) { event.preventDefault(); loadGame(game); }
  }
});
drawStrengths(); drawSides(); showPage('home');
