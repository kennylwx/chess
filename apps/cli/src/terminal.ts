import { stdin, stdout } from 'node:process';

export type GraphicsMode = 'auto' | 'kitty' | 'text';
const QUERY_ID = 73192;

/** Environment variables can disable probing, but cannot prove graphics support. */
export function supportsGraphics(mode: GraphicsMode, tty = Boolean(stdout.isTTY && stdin.isTTY), env = process.env, confirmed = false): boolean {
  if (!tty || mode === 'text') return false;
  if (mode === 'kitty') return true;
  if (env.TMUX || env.STY || env.TERM === 'dumb') return false;
  return confirmed;
}

/** Probe before readline owns stdin. A query does not store or display an image. */
export async function detectGraphics(mode: GraphicsMode, input = stdin, output = stdout, env = process.env, timeout = 300): Promise<boolean> {
  const tty = Boolean(input.isTTY && output.isTTY);
  if (mode !== 'auto' || !tty || env.TMUX || env.STY || env.TERM === 'dumb') {
    return supportsGraphics(mode, tty, env);
  }
  const wasRaw = input.isRaw;
  const wasFlowing = input.readableFlowing === true;
  let pending = '';
  let keyboard = '';
  let confirmed = false;
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
      // Preserve keys typed during startup, but never replay terminal replies.
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
          if (reply[1].split(',').includes(`i=${QUERY_ID}`)) confirmed = reply[2] === 'OK';
          pending = pending.slice(reply[0].length);
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
            '\x1b[?'.startsWith(pending) || /^\x1b\[\?[\d;]*$/.test(pending)) break;
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
      output.write(`\x1b_Gi=${QUERY_ID},s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\\x1b[c`);
    } catch (error) { finish(error as Error); }
  });
}
