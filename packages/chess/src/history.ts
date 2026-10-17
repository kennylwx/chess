import type { Chess } from './index.js';

/** Undo through the player's most recent move, including any engine reply. */
export function undoTurn(chess: Chess, human: 'w' | 'b'): boolean {
  let index = chess.history.length - 1;
  while (index >= 0 && chess.history[index].before.turn !== human) index--;
  if (index < 0) return false;
  while (chess.history.length > index) chess.undo();
  return true;
}

export function moveHistory(chess: Chess, width = 80): string {
  const groups: string[] = [];
  for (const entry of chess.history) {
    const { fullmove, turn } = entry.before;
    if (turn === 'w') groups.push(`${fullmove}. ${entry.san}`);
    else if (groups.length) groups[groups.length - 1] += ` ${entry.san}`;
    else groups.push(`${fullmove}… ${entry.san}`);
  }
  if (!groups.length) return 'Moves: —';
  let clipped = false;
  while (groups.length > 1 && `Moves: ${clipped ? '… ' : ''}${groups.join(' ')}`.length > width) {
    groups.shift();
    clipped = true;
  }
  return `Moves: ${clipped ? '… ' : ''}${groups.join(' ')}`;
}
