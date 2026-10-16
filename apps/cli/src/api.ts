import type { Chess } from '@check/chess';
export interface MoveResult { move:string; fen:string; explanation:string }
export class CheckServerClient {
  constructor(private readonly baseUrl=process.env.CHECK_SERVER_URL||'http://localhost:8000'){}
  async resolve(text:string,chess:Chess):Promise<MoveResult>{return this.post('/api/resolve',{instruction:text,fen:chess.fen()});}
  async engine(fen:string,elo:number,depth:number):Promise<MoveResult>{return this.post('/api/engine',{fen,elo,depth});}
  private async post(path:string,body:unknown):Promise<MoveResult>{const response=await fetch(this.baseUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(`Check server failed (${response.status}): ${(await response.text()).slice(0,200)}`);return response.json() as Promise<MoveResult>;}
}
