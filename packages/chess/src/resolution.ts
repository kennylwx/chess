import type { Chess } from './index.js';
export interface MoveResult { move: string; fen: string; explanation: string }
export interface MoveResolver { resolve(text: string, chess: Chess): Promise<MoveResult> }
export class ResolutionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
