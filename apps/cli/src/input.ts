import { squareName } from '@check/chess';
import type { Chess } from '@check/chess';
import type { CheckServerClient } from './api.js';

export type InputIntent =
  | { type:'empty' }
  | { type:'quit' }
  | { type:'help' }
  | { type:'undo' }
  | { type:'show-fen' }
  | { type:'load-fen'; value:string }
  | { type:'move'; value:string; source:'notation'|'jev'; fen?:string; explanation?:string };

/** Parse local commands/notation; delegate all genuinely free-form text to JEV. */
export async function modelInput(raw:string, chess:Chess, server?:Pick<CheckServerClient,'resolve'>):Promise<InputIntent> {
  const text = String(raw).trim();
  const lower = text.toLowerCase();
  if (!text) return { type: 'empty' };
  if (/^(quit|exit|q)$/.test(lower)) return { type: 'quit' };
  if (/^(help|\?)$/.test(lower)) return { type: 'help' };
  if (/^(undo|take ?back)$/.test(lower)) return { type: 'undo' };
  if (/^(fen|position)$/.test(lower)) return { type: 'show-fen' };
  if (lower.startsWith('fen ')) return { type: 'load-fen', value: text.slice(4).trim() };

  const legal = chess.moves();
  const normalized = text.replace(/[!?+#]/g, '').replace(/0/g, 'O');
  const exact = legal.find(move => {
    const uci = squareName(move.from) + squareName(move.to) + (move.promotion || '');
    return uci === normalized.toLowerCase() || chess.san(move, legal).replace(/[+#]/g, '') === normalized;
  });
  if (exact) return { type: 'move', value: squareName(exact.from) + squareName(exact.to) + (exact.promotion || ''), source: 'notation' };

  if (!server) throw new Error('Check server is required for natural-language input');
  const result = await server.resolve(text, chess);
  return { type: 'move', value: result.move, fen: result.fen, explanation: result.explanation, source: 'jev' };
}
