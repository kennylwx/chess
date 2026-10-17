import type { Chess } from '@chess/chess';

const PIECES: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
const OUTLINES: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
const RESET = '\x1b[0m';
interface RenderOptions { perspective?: 'w' | 'b'; last?: number[] | null; color?: boolean; compact?: boolean }

export function render(chess: Chess, { perspective = 'w', last = null, color = Boolean(process.stdout.isTTY), compact = false }: RenderOptions = {}): string {
  const rows = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const green = (text: string): string => color ? `\x1b[38;5;114m${text}${RESET}` : text;
  const border = green(`   +${'-'.repeat(56)}+`);
  const output = [border];

  for (const rank of rows) {
    for (const line of compact ? [1] : [0, 1, 2]) {
      let row = green(`${line === 1 ? ` ${8 - rank} ` : '   '}|`);
      for (const file of files) {
        const index = rank * 8 + file;
        const piece = chess.board[index];
        const white = piece !== null && piece === piece.toUpperCase();
        const glyph = piece ? (!color && white ? OUTLINES[piece] : PIECES[piece]) : ' ';
        let cell = line === 1 ? `   ${glyph}   ` : '       ';
        if (color) {
          const background = last?.includes(index) ? 107 : (rank + file) % 2 ? 65 : 108;
          cell = `\x1b[1;48;5;${background};38;5;${white ? 231 : 16}m${cell}${RESET}`;
        } else if (!piece && line === 1) {
          cell = (rank + file) % 2 ? '   ·   ' : '       ';
        }
        row += cell;
      }
      output.push(row + green('|'));
    }
  }
  output.push(border);
  output.push(green('    ' + files.map(file => `   ${'abcdefgh'[file]}   `).join('')));
  output.push(color
    ? `    \x1b[1;38;5;231m♚ White${RESET}    ${green('♚ Black · dark pieces')}`
    : '    ♔ White    ♚ Black');
  return output.join('\n') + '\n';
}
