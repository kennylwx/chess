import { Chess, squareName } from './index.js';

const names: Record<string, string> = { P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King' };

/** Explain a recognizable move rejected for king safety, without changing the game. */
export function illegalMoveReason(input: string, chess: Chess): string | undefined {
  const text = input.trim();
  const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
  const san = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?[+#]?$/.exec(text);
  const words = text.toLowerCase();
  const squares = words.match(/[a-h][1-8]/g) || [];
  const named = words.match(/\bwith (?:my |the |a )?(pawn|knight|bishop|rook|queen|king)\b/)?.[1]
    || words.match(/\b(pawn|knight|bishop|rook|queen|king)\b/)?.[1];
  const kind = uci ? undefined : san ? san[1] || 'P'
    : Object.keys(names).find(key => names[key].toLowerCase() === named);
  const from = uci?.[1] || (squares.length > 1 ? squares[0] : undefined);
  const to = uci?.[2] || san?.[5] || squares.at(-1);
  if (!to || (!uci && !san && !kind && !from)) return;
  const capture = san ? Boolean(san[4]) : /\b(take|takes|taking|capture|captures|capturing)\b/.test(words);
  const candidates = chess.pseudo().filter(move => {
    if (squareName(move.to) !== to) return false;
    if (from && squareName(move.from) !== from) return false;
    if (kind && chess.board[move.from]!.toUpperCase() !== kind) return false;
    if (san?.[2] && squareName(move.from)[0] !== san[2]) return false;
    if (san?.[3] && squareName(move.from)[1] !== san[3]) return false;
    if (capture && !/[ce]/.test(move.flags)) return false;
    return true;
  });
  const legal = chess.moves();
  // A legal interpretation or multiple possible pieces needs clarification, not a pin claim.
  if (candidates.length !== 1 || legal.some(move => move.from === candidates[0].from && move.to === candidates[0].to)) return;
  const move = candidates[0];
  const copy = new Chess(chess.fen());
  copy.apply(move);
  if (!copy.inCheck(chess.turn)) return;
  const piece = chess.board[move.from]!.toUpperCase();
  if (piece === 'K') return `King cannot move to ${to}: that square is attacked.`;
  if (chess.inCheck()) return 'You are in check; this move would leave your king in check.';

  const king = chess.board.indexOf(chess.turn === 'w' ? 'K' : 'k');
  const dr = Math.floor(move.from / 8) - Math.floor(king / 8);
  const df = move.from % 8 - king % 8;
  if (dr === 0 || df === 0 || Math.abs(dr) === Math.abs(df)) {
    const stepR = Math.sign(dr), stepF = Math.sign(df);
    let rank = Math.floor(king / 8) + stepR, file = king % 8 + stepF;
    let passedPiece = false;
    while (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
      const index = rank * 8 + file;
      const blocker = chess.board[index];
      if (index === move.from) passedPiece = true;
      else if (blocker) {
        const enemy = (blocker === blocker.toUpperCase() ? 'w' : 'b') !== chess.turn;
        const slider = (dr === 0 || df === 0 ? 'RQ' : 'BQ').includes(blocker.toUpperCase());
        if (passedPiece && enemy && slider) {
          return `${names[piece]} ${squareName(move.from)} is pinned by ${names[blocker.toUpperCase()].toLowerCase()} ${squareName(index)}; moving it exposes your king.`;
        }
        break;
      }
      rank += stepR;
      file += stepF;
    }
  }
  return `${names[piece]} ${squareName(move.from)} cannot move to ${to}: it would expose your king to check.`;
}
