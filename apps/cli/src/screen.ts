import { stdout } from 'node:process';

interface Output {
  columns?: number;
  write(text: string): unknown;
}

/** Keep game frames out of shell scrollback and restore the shell on exit. */
export class GameScreen {
  private opened = false;
  constructor(readonly active: boolean, private readonly output: Output = stdout) {}

  open(): void {
    if (this.active && !this.opened) {
      this.output.write('\x1b[?1049h');
      this.opened = true;
    }
  }

  draw(header: string, board: string, status: string, moves = ''): void {
    if (!this.active) {
      this.output.write(`${header}\n${board}\n${moves}\n${status}\n`);
      return;
    }
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const fit = (text: string): string => [...text.replace(/[\x00-\x1f\x7f]/g, ' ')].slice(0, width).join('');
    // Synchronized output prevents a visible blank frame between positions.
    this.output.write('\x1b[?2026h\x1b[H\x1b[2J' +
      `${fit(header)}\r\n\r\n${board}\r\n${fit(moves)}\r\n${fit(status)}\r\n` + '\x1b[?2026l');
  }

  close(): void {
    if (this.opened) {
      this.output.write('\x1b[?2026l\x1b[?25h\x1b[?1049l');
      this.opened = false;
    }
  }
}
