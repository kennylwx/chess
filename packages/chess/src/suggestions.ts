import { squareName, type Chess } from './index.js';

const names: Record<string, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
export const looksLikeNotation = (text: string): boolean => !/\s/.test(text) && (/\d/.test(text) || /^[O0]-[O0]/.test(text));

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}

/** Rank only legal moves related to the requested piece, square or capture. */
export function suggestMoves(input: string, chess: Chess): string[] {
  const text = input.trim();
  const lower = text.toLowerCase();
  const notation = looksLikeNotation(text);
  const squares = lower.match(/[a-h][1-8]/g) || [];
  const destination = squares.at(-1);
  const source = squares.length > 1 ? squares[0] : undefined;
  const named = lower.match(/\bwith (?:my |the |a )?(king|queen|rook|bishop|knight|pawn)\b/)?.[1]
    || lower.match(/\b(king|queen|rook|bishop|knight|pawn)\b/)?.[1];
  const piece = named ? names[named] : notation && !/^[a-h][1-8][a-h][1-8]/.test(text)
    ? (/^[KQRBN]/.exec(text)?.[0] || (/^[a-h]/.test(text) ? 'P' : undefined)) : undefined;
  const capture = notation ? text.includes('x') : /\b(take|takes|taking|capture|captures|capturing)\b/.test(lower);
  const castle = /\bcastl/.test(lower) || /^[O0]-[O0]/.test(text);
  if (!notation && !piece && !destination && !capture && !castle) return [];
  const legal = chess.moves();
  return legal.map(move => {
    const san = chess.san(move, legal);
    const from = squareName(move.from), to = squareName(move.to);
    const kind = chess.board[move.from]!.toUpperCase();
    if (piece && kind !== piece) return null;
    if (source && from !== source) return null;
    if (capture && !san.includes('x')) return null;
    if (castle && !san.startsWith('O-O')) return null;
    if (!notation && destination && to !== destination) return null;
    const uci = from + to + (move.promotion || '');
    const difference = Math.min(distance(text, san), distance(lower, uci));
    if (notation && difference > 2 && to !== destination) return null;
    return { san, score: (to === destination ? 20 : 0) + (from === source ? 10 : 0) - difference };
  }).filter((entry): entry is { san: string; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score || a.san.localeCompare(b.san)).slice(0, 5).map(entry => entry.san);
}

export function suggestionMessage(input: string, chess: Chess): string {
  const moves = suggestMoves(input, chess);
  return moves.length ? `No exact match. Try: ${moves.join(' · ')}` : 'No matching legal move. Specify the piece and target square.';
}
