import { stdout } from 'node:process';

interface Output {
  columns?: number;
  rows?: number;
  write(text: string): unknown;
}

/** Keep game frames out of shell scrollback and restore the shell on exit. */
export class GameScreen {
  private opened = false;
  constructor(readonly active: boolean, private readonly output: Output = stdout, private readonly manageScreen = true) {}

  open(): void {
    if (this.active && this.manageScreen && !this.opened) {
      this.output.write('\x1b[?1049h');
      this.opened = true;
    }
  }

  draw(header: string, board: string, status: string, moves = ''): void {
    if (!this.active) {
      this.output.write(`${header}\n${moves}\n${board}\n${status}\n`);
      return;
    }
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const fit = (text: string): string => [...text.replace(/[\x00-\x1f\x7f]/g, ' ')].slice(0, width).join('');
    // Synchronized output prevents a visible blank frame between positions.
    const title = `\x1b[48;2;22;53;37m\x1b[38;2;224;242;215m${fit(header).padEnd(width)}\x1b[0m`;
    const history = `\x1b[48;2;31;65;45m\x1b[38;2;190;221;173m${fit(moves).padEnd(width)}\x1b[0m`;
    const controls = ' Ctrl+U Undo  B Menu  Q Quit';
    const statusWidth = Math.max(0, width - controls.length);
    const footer = `\x1b[48;2;35;49;39m\x1b[38;2;210;225;202m${fit(status).slice(0, statusWidth).padEnd(statusWidth)}${controls.slice(-Math.min(width, controls.length))}\x1b[0m`;
    const bottom = Math.max(4, this.output.rows || 40);
    this.output.write('\x1b[?2026h\x1b[H\x1b[2J' +
      `${title}\r\n${history}\r\n${board}\x1b[${bottom - 1};1H${footer}` +
      this.inputFrame('', 'free text') + '\x1b[?2026l');
  }

  input(value: string, placeholder = 'free text'): void {
    if (this.active) this.output.write(this.inputFrame(value, placeholder));
  }

  private inputFrame(value: string, placeholder: string): string {
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const bottom = Math.max(4, this.output.rows || 40);
    const visible = [...value].slice(-Math.max(0, width - 4)).join('');
    const content = value ? visible : placeholder;
    const foreground = value ? '\x1b[38;2;235;248;226m' : '\x1b[38;2;139;168;144m';
    const row = `\x1b[48;2;12;42;34m\x1b[38;2;190;221;173m❯  ${foreground}${content}`;
    const used = 3 + [...content].length;
    const cursor = Math.min(width, 4 + [...visible].length);
    return `\x1b[${bottom};1H${row}${' '.repeat(Math.max(0, width - used))}\x1b[0m\x1b[${bottom};${cursor}H`;
  }

  close(): void {
    if (this.opened) {
      this.output.write('\x1b[?2026l\x1b[?25h\x1b[?1049l');
      this.opened = false;
    }
  }
}

/** Full-screen start and load menus that replace one another without scrollback. */
export class MenuScreen {
  private opened = false;
  constructor(readonly active: boolean, private readonly output: Output = stdout) {}

  open(): void {
    if (this.active && !this.opened) {
      this.output.write('\x1b[?1049h\x1b[?25l');
      this.opened = true;
    }
  }

  draw(header: string, content: string, footer: string): void {
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const fit = (text: string): string => [...text.replace(/[\x00-\x1f\x7f]/g, ' ')].slice(0, width).join('');
    if (!this.active) {
      this.output.write(`${header}\n${content}\n${footer}\n`);
      return;
    }
    const title = `\x1b[48;2;22;53;37m\x1b[38;2;224;242;215m${fit(header).padEnd(width)}\x1b[0m`;
    const status = `\x1b[48;2;35;49;39m\x1b[38;2;210;225;202m${fit(footer).padEnd(width)}\x1b[0m`;
    const body = content.split('\n').map(line => fit(line)).join('\r\n');
    this.output.write(`\x1b[?2026h\x1b[H\x1b[2J${title}\r\n\r\n${body}\r\n\r\n${status}\r\n\x1b[?2026l`);
  }

  close(): void {
    if (this.opened) {
      this.output.write('\x1b[?25h\x1b[?1049l');
      this.opened = false;
    }
  }
}
