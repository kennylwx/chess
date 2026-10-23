import { stdin, stdout } from 'node:process';

export type GraphicsMode = 'auto' | 'kitty' | 'text' | 'ascii';
const QUERY_ID = 73192;

function blocksAutoGraphics(env: NodeJS.ProcessEnv): boolean {
  // Konsole 25.04.2 acknowledges Kitty queries but was observed to ignore our
  // single-dimension placement, clipping the board over the input field.
  // Keep auto conservative until its placement is empirically validated.
  const candidate = env.TERM === 'xterm-kitty' || env.TERM === 'xterm-ghostty' ||
    ['kitty', 'ghostty'].includes(env.TERM_PROGRAM?.toLowerCase() ?? '');
  // Unknown emulators can print APC payloads into shell scrollback (observed
  // in QTerminal 2.1.0). A hint permits probing; only an OK reply enables images.
  return Boolean(!candidate || env.TMUX || env.STY || env.TERM === 'dumb' ||
    env.KONSOLE_VERSION || env.TERM_PROGRAM?.toLowerCase() === 'konsole');
}

/** Environment variables can disable probing, but cannot prove graphics support. */
export function supportsGraphics(mode: GraphicsMode, tty = Boolean(stdout.isTTY && stdin.isTTY), env = process.env, confirmed = false): boolean {
  if (!tty || (mode === 'text' || mode === 'ascii')) return false;
  if (mode === 'kitty') return true;
  if (blocksAutoGraphics(env)) return false;
  return confirmed;
}

/** Isolate protocol replies from readline. Queries do not store or display images. */
export async function detectGraphics(mode: GraphicsMode, input = stdin, output = stdout, env = process.env, timeout = 300, onCellAspect?: (ratio: number) => void): Promise<boolean> {
  const tty = Boolean(input.isTTY && output.isTTY);
  if ((mode === 'text' || mode === 'ascii') || !tty || env.TMUX || env.STY || env.TERM === 'dumb' ||
      (mode === 'auto' && blocksAutoGraphics(env))) {
    return supportsGraphics(mode, tty, env);
  }
  const previous = input.listeners('data') as Array<(chunk: Buffer | string) => void>;
  previous.forEach(listener => input.off('data', listener));
  const wasRaw = input.isRaw;
  const wasFlowing = input.readableFlowing === true;
  let pending = '';
  let keyboard = '';
  let confirmed = mode === 'kitty';
  return await new Promise<boolean>((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      input.pause();
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      input.setRawMode(Boolean(wasRaw));
      previous.forEach(listener => input.on('data', listener));
      // Preserve keys typed during a probe, but never replay terminal replies.
      if (keyboard) input.unshift(Buffer.from(keyboard));
      if (wasFlowing) input.resume();
      if (error) reject(error); else resolve(confirmed);
    };
    const onEnd = (): void => finish();
    const onError = (error: Error): void => finish(error);
    const onData = (chunk: Buffer | string): void => {
      pending += chunk.toString();
      while (pending) {
        if (pending[0] !== '\x1b') {
          keyboard += pending[0];
          pending = pending.slice(1);
          continue;
        }
        const reply = pending.match(/^\x1b_G([^;]*);([^\x1b]*)\x1b\\/);
        if (reply) {
          if (mode === 'auto' && reply[1].split(',').includes(`i=${QUERY_ID}`)) confirmed = reply[2] === 'OK';
          pending = pending.slice(reply[0].length);
          continue;
        }
        const cellSize = pending.match(/^\x1b\[6;(\d+);(\d+)t/);
        if (cellSize) {
          const height = Number(cellSize[1]), width = Number(cellSize[2]);
          if (height > 0 && width > 0 && height <= 1000 && width <= 1000) onCellAspect?.(height / width);
          pending = pending.slice(cellSize[0].length);
          continue;
        }
        const attributes = pending.match(/^\x1b\[\?[\d;]*c/);
        if (attributes) {
          keyboard += pending.slice(attributes[0].length);
          pending = '';
          finish();
          return;
        }
        // Buffer fragmented responses, preserving unrelated escape keys.
        if ('\x1b_G'.startsWith(pending) || pending.startsWith('\x1b_G') ||
            '\x1b[?'.startsWith(pending) || /^\x1b\[(?:\?[\d;]*|6[;\d]*)$/.test(pending)) break;
        keyboard += pending[0];
        pending = pending.slice(1);
      }
    };
    const timer = setTimeout(() => finish(), timeout);
    input.on('data', onData);
    input.once('end', onEnd);
    input.once('error', onError);
    try {
      input.setRawMode(true);
      input.resume();
      output.write(`\x1b_Gi=${QUERY_ID},s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\\x1b[16t\x1b[c`);
    } catch (error) { finish(error as Error); }
  });
}
