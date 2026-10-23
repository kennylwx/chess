import type { Chess } from '@zchess/chess';

const PIECES: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
const OUTLINES: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
const RESET = '\x1b[0m';
interface RenderOptions { perspective?: 'w' | 'b'; last?: number[] | null; color?: boolean; compact?: boolean; ascii?: boolean }

export function render(chess: Chess, { perspective = 'w', last = null, color = Boolean(process.stdout.isTTY), compact = false, ascii = false }: RenderOptions = {}): string {
  const rows = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  // Typical terminal cells are about twice as tall as they are wide. Keep
  // compact ranks proportional too, and allow narrow windows to shrink.
  const cellWidth = Math.max(1, Math.min(compact ? 2 : 6, Math.floor(((process.stdout.columns || 80) - 8) / 8)));
  const cell = (content = ''): string => {
    const left = Math.floor((cellWidth - 1) / 2);
    return `${' '.repeat(left)}${content}${' '.repeat(cellWidth - left - (content ? 1 : 0))}`;
  };
  const defaultText = (text: string): string => color ? `\x1b[39m${text}${RESET}` : text;
  const border = defaultText(`   +${'-'.repeat(cellWidth * 8)}+`);
  const output = [border];

  for (const rank of rows) {
    for (const line of compact ? [1] : [0, 1, 2]) {
      let row = defaultText(`${line === 1 ? ` ${8 - rank} ` : '   '}|`);
      for (const file of files) {
        const index = rank * 8 + file;
        const piece = chess.board[index];
        const white = piece !== null && piece === piece.toUpperCase();
        const glyph = piece ? (ascii ? piece : !color && white ? OUTLINES[piece] : PIECES[piece]) : ' ';
        let square = cell(line === 1 ? glyph : '');
        if (color) {
          const background = last?.includes(index) ? 107 : (rank + file) % 2 ? 65 : 108;
          square = `\x1b[1;48;5;${background};38;5;${white ? 231 : 16}m${square}${RESET}`;
        } else if (!piece && line === 1) {
          square = cell((rank + file) % 2 ? (ascii ? '.' : '·') : '');
        }
        row += square;
      }
      output.push(row + defaultText('|'));
    }
  }
  output.push(border);
  output.push(defaultText('    ' + files.map(file => cell('abcdefgh'[file])).join('')));
  output.push(ascii ? defaultText('    White: KQRBNP  Black: kqrbnp') : color
    ? defaultText('    ♔ White    ♚ Black · dark pieces')
    : '    ♔ White    ♚ Black');
  return output.join('\n') + '\n';
}
