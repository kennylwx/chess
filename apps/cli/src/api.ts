import type { Chess } from '@zchess/chess';
import { ResolutionError, type MoveResult } from '@zchess/chess/interaction';
export { ResolutionError, type MoveResult } from '@zchess/chess/interaction';
export class ChessServerClient {
  constructor(private readonly baseUrl=process.env.ZCHESS_SERVER_URL||'http://localhost:8000', private readonly signal?:AbortSignal){}
  async resolve(text:string,chess:Chess):Promise<MoveResult>{return this.post('/api/resolve',{instruction:text,fen:chess.fen()});}
  private async post(path:string,body:unknown):Promise<MoveResult>{const response=await fetch(this.baseUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:this.signal});if(!response.ok){
    const body = await response.json().catch(() => ({})) as {detail?:unknown};
    throw new ResolutionError(typeof body.detail === 'string' ? body.detail : `Chess server failed (${response.status})`, response.status);
  }return response.json() as Promise<MoveResult>;}
}
