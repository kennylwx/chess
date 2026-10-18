import { createRequire } from 'node:module';
import type { Chess } from '@chess/chess';
import piecesData from '@chess/chess/pieces' with { type: 'json' };

const require = createRequire(import.meta.url);
const pieces = piecesData as Record<string, string>;
const IMAGE_ID = 73191;
export type GraphicsMode = 'auto' | 'kitty' | 'text';

export function supportsGraphics(mode: GraphicsMode, tty = Boolean(process.stdout.isTTY), env = process.env): boolean {
  if (!tty || mode === 'text') return false;
  if (mode === 'kitty') return true;
  if (env.TMUX || env.STY) return false;
  return env.TERM_PROGRAM === 'ghostty' || env.TERM === 'xterm-ghostty' || env.TERM === 'xterm-kitty';
}

export function boardSvg(chess: Chess, perspective: 'w' | 'b', last: number[] | null): string {
  const order = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">',
    '<rect width="768" height="768" rx="12" fill="#14291f"/>'];
  for (const [y, rank] of order.entries()) {
    for (const [x, file] of order.entries()) {
      const index = rank * 8 + file;
      const left = 24 + x * 90, top = 24 + y * 90;
      const fill = last?.includes(index) ? '#b4cf68' : (rank + file) % 2 ? '#64916d' : '#d5e5cb';
      svg.push(`<rect x="${left}" y="${top}" width="90" height="90" fill="${fill}"/>`);
      const piece = chess.board[index];
      if (piece) svg.push(`<g transform="translate(${left} ${top}) scale(2)">${pieces[piece]}</g>`);
    }
    svg.push(`<text x="12" y="${24 + y * 90 + 50}" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#d5e5cb">${8 - rank}</text>`);
  }
  for (const [x, file] of order.entries()) {
    svg.push(`<text x="${24 + x * 90 + 45}" y="762" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#d5e5cb">${'abcdefgh'[file]}</text>`);
  }
  svg.push('</svg>');
  return svg.join('');
}

export function boardPng(chess: Chess, perspective: 'w' | 'b', last: number[] | null): Buffer {
  const { Resvg } = require('@resvg/resvg-js') as typeof import('@resvg/resvg-js');
  return new Resvg(boardSvg(chess, perspective, last)).render().asPng();
}

export function renderGraphics(chess: Chess, perspective: 'w' | 'b', last: number[] | null, fixed = false): string {
  // The supplied Ghostty screenshot shows that this terminal's cells are a
  // little narrower than the usual 2:1 estimate. Use a 2.2:1 placement so the
  // rendered board squares do not appear tall.
  const columnsPerRow = 2.2;
  const availableRows = Math.max(1, (process.stdout.rows || 40) - (fixed ? 8 : 7));
  const availableColumns = Math.max(2, (process.stdout.columns || 80) - 2);
  const rows = Math.max(1, Math.min(32, availableRows, Math.floor(availableColumns / columnsPerRow)));
  const columns = Math.min(availableColumns, Math.round(rows * columnsPerRow));
  const data = boardPng(chess, perspective, last).toString('base64');
  // Reserve room first: images anchored near the bottom must not cover the prompt.
  let output = `\x1b_Ga=d,d=I,i=${IMAGE_ID},q=2;\x1b\\`;
  if (!fixed) output += '\n'.repeat(rows) + `\x1b[${rows}A\r`;
  for (let offset = 0; offset < data.length; offset += 4096) {
    const chunk = data.slice(offset, offset + 4096);
    const more = offset + 4096 < data.length ? 1 : 0;
    const control = offset === 0 ? `a=T,f=100,t=d,i=${IMAGE_ID},c=${columns},r=${rows},C=1,q=2,` : '';
    output += `\x1b_G${control}m=${more};${chunk}\x1b\\`;
  }
  return output + `\x1b[${rows}B\r`;
}
