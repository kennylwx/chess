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
      this.output.write(`${header}\n${moves}\n\n${board}\n${status}\n`);
      return;
    }
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const fit = (text: string): string => [...text.replace(/[\x00-\x1f\x7f]/g, ' ')].slice(0, width).join('');
    // Synchronized output prevents a visible blank frame between positions.
    const title = `\x1b[38;2;224;242;215m${fit(header).padEnd(width)}\x1b[0m`;
    const history = `\x1b[38;2;190;221;173m${fit(moves).padEnd(width)}\x1b[0m`;
    const horizontalPadding = Math.min(1, Math.floor((width - 1) / 2));
    const innerWidth = Math.max(1, width - horizontalPadding * 2);
    const controls = '/help';
    const visibleControls = controls.slice(-Math.min(innerWidth, controls.length));
    const statusWidth = Math.max(0, innerWidth - visibleControls.length);
    const footer = `\x1b[38;2;224;242;215m${' '.repeat(horizontalPadding)}${fit(status).slice(0, statusWidth).padEnd(statusWidth)}${visibleControls}${' '.repeat(horizontalPadding + 1)}\x1b[0m`;
    const bottom = Math.max(6, this.output.rows || 40);
    this.output.write('\x1b[?2026h\x1b[H\x1b[2J' +
      `${title}\r\n${history}\r\n\r\n${board}\x1b[${bottom - 4};1H${footer}` +
      this.inputFrame('', 'Type any moves e.g. e4 or e pawn up 2') + '\x1b[?2026l');
  }

  input(value: string, placeholder = 'Type any moves e.g. e4 or e pawn up 2'): void {
    if (this.active) this.output.write(this.inputFrame(value, placeholder));
  }

  private inputFrame(value: string, placeholder: string): string {
    const width = Math.max(1, (this.output.columns || 80) - 1);
    const bottom = Math.max(6, this.output.rows || 40);
    const visible = [...value].slice(-Math.max(0, width - 4)).join('');
    const content = value ? visible : placeholder;
    const foreground = value ? '\x1b[38;2;235;248;226m' : '\x1b[38;2;139;168;144m';
    const horizontalPadding = 1;
    const fieldTextWidth = Math.max(0, width - horizontalPadding - 2);
    const shown = [...content].slice(-fieldTextWidth).join('');
    const prefix = ' ';
    const background = '\x1b[48;2;12;42;34m';
    const paddingRow = `${background}${' '.repeat(width + 1)}\x1b[0m`;
    const row = `${background}\x1b[38;2;190;221;173m${prefix}${foreground}${shown}${' '.repeat(Math.max(0, width + 1 - prefix.length - [...shown].length))}\x1b[0m`;
    const cursor = Math.min(width, prefix.length + [...shown].length + 1);
    return `\x1b[${bottom - 2};1H${paddingRow}` +
      `\x1b[${bottom - 1};1H${row}` +
      `\x1b[${bottom};1H${paddingRow}\x1b[${bottom - 1};${cursor}H`;
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
    const title = `\x1b[38;2;224;242;215m${fit(header).padEnd(width)}\x1b[0m`;
    const horizontalPadding = Math.min(2, Math.floor((width - 1) / 2));
    const status = `\x1b[38;2;210;225;202m${' '.repeat(horizontalPadding)}${fit(footer).slice(0, width - horizontalPadding * 2).padEnd(width - horizontalPadding * 2)}${' '.repeat(horizontalPadding)}\x1b[0m`;
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
