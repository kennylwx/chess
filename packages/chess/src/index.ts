export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const KNIGHT: Direction[] = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING: Direction[] = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
type Side = 'w' | 'b';
type Piece = 'P'|'N'|'B'|'R'|'Q'|'K'|'p'|'n'|'b'|'r'|'q'|'k';
type Direction = [number, number];
export interface Move { from:number; to:number; promotion:string|null; flags:string }
export interface PositionSnapshot { board:(Piece|null)[]; turn:Side; castling:string; ep:number; halfmove:number; fullmove:number }
export interface HistoryEntry { move:Move; san:string; before:PositionSnapshot }

export const squareName = (i:number):string => FILES[i % 8] + (8 - Math.floor(i / 8));
export const squareIndex = (s:string):number => /^[a-h][1-8]$/i.test(s) ? (8 - Number(s[1])) * 8 + FILES.indexOf(s[0].toLowerCase()) : -1;
const color = (p:Piece|null):Side|null => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;

export class Chess {
  board:(Piece|null)[]=[]; turn:Side='w'; castling=''; ep=-1; halfmove=0; fullmove=1; history:HistoryEntry[]=[];
  constructor(fen:string = START_FEN) { this.load(fen); }
  load(fen:string):this {
    const [placement, turn, castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const ranks = placement?.split('/');
    if (!ranks || ranks.length !== 8 || !/^[wb]$/.test(turn)) throw new Error('Invalid FEN');
    this.board = [];
    for (const rank of ranks) {
      for (const c of rank) {
        if (/\d/.test(c)) this.board.push(...Array(Number(c)).fill(null));
        else if (/[prnbqkPRNBQK]/.test(c)) this.board.push(c as Piece);
        else throw new Error('Invalid FEN');
      }
    }
    if (this.board.length !== 64) throw new Error('Invalid FEN');
    this.turn = turn as Side; this.castling = castling === '-' ? '' : castling; this.ep = ep === '-' ? -1 : squareIndex(ep);
    this.halfmove = Number(half); this.fullmove = Number(full); this.history = [];
    if (this.ep < -1 || !Number.isFinite(this.halfmove) || !Number.isFinite(this.fullmove)) throw new Error('Invalid FEN');
    return this;
  }
  fen():string {
    let out = '';
    for (let r=0;r<8;r++) { let empty=0; for(let f=0;f<8;f++){ const p=this.board[r*8+f]; if(!p) empty++; else {if(empty){out+=empty;empty=0;} out+=p;} } if(empty)out+=empty; if(r<7)out+='/'; }
    return `${out} ${this.turn} ${this.castling || '-'} ${this.ep < 0 ? '-' : squareName(this.ep)} ${this.halfmove} ${this.fullmove}`;
  }
  attacked(sq:number, by:Side):boolean {
    const r=Math.floor(sq/8), f=sq%8;
    const pawn = by==='w'?'P':'p', pawnRow = r + (by==='w'?1:-1);
    for(const df of [-1,1]) if(pawnRow>=0&&pawnRow<8&&f+df>=0&&f+df<8&&this.board[pawnRow*8+f+df]===pawn)return true;
    for(const [df,dr] of KNIGHT){const rr=r+dr,ff=f+df;if(rr>=0&&rr<8&&ff>=0&&ff<8&&this.board[rr*8+ff]===(by==='w'?'N':'n'))return true;}
    for(const [df,dr] of KING){const rr=r+dr,ff=f+df;if(rr>=0&&rr<8&&ff>=0&&ff<8&&this.board[rr*8+ff]===(by==='w'?'K':'k'))return true;}
    for(const [df,dr,types] of [[1,0,'RQ'],[-1,0,'RQ'],[0,1,'RQ'],[0,-1,'RQ'],[1,1,'BQ'],[-1,1,'BQ'],[1,-1,'BQ'],[-1,-1,'BQ']] as [number,number,string][]) {
      let rr=r+dr,ff=f+df; while(rr>=0&&rr<8&&ff>=0&&ff<8){const p=this.board[rr*8+ff];if(p){if(color(p)===by&&types.includes(p.toUpperCase()))return true;break;}rr+=dr;ff+=df;
    }} return false;
  }
  inCheck(side:Side=this.turn):boolean { const king=this.board.indexOf(side==='w'?'K':'k'); return king<0 || this.attacked(king,side==='w'?'b':'w'); }
  pseudo():Move[] {
    const moves:Move[]=[];
    const add=(from:number,to:number,promotion:string|null=null,flags='')=>moves.push({from,to,promotion,flags});
    for(let from=0;from<64;from++){const p=this.board[from];if(!p||color(p)!==this.turn)continue;const type=p.toUpperCase(),r=Math.floor(from/8),f=from%8;
      if(type==='P'){const dir=this.turn==='w'?-1:1, home=this.turn==='w'?6:1, last=this.turn==='w'?0:7;const one=(r+dir)*8+f;
        if(r+dir>=0&&r+dir<8&&!this.board[one]){if(r+dir===last)for(const q of 'qrbn')add(from,one,q,'p');else add(from,one);const two=(r+2*dir)*8+f;if(r===home&&!this.board[two])add(from,two,null,'d');}
        for(const df of [-1,1]){const rr=r+dir,ff=f+df;if(rr<0||rr>7||ff<0||ff>7)continue;const to=rr*8+ff;if((this.board[to]&&color(this.board[to])!==this.turn)||to===this.ep){if(rr===last)for(const q of 'qrbn')add(from,to,q,to===this.ep?'ep':'cp');else add(from,to,null,to===this.ep?'e':'c');}}
      } else if(type==='N'||type==='K'){for(const [df,dr] of type==='N'?KNIGHT:KING){const rr=r+dr,ff=f+df;if(rr>=0&&rr<8&&ff>=0&&ff<8&&color(this.board[rr*8+ff])!==this.turn)add(from,rr*8+ff,null,this.board[rr*8+ff]?'c':'');}
        if(type==='K')this.castleMoves(from,add);
      } else {const dirs=type==='B'?KING.slice(4):type==='R'?KING.slice(0,4):KING;for(const[df,dr]of dirs){let rr=r+dr,ff=f+df;while(rr>=0&&rr<8&&ff>=0&&ff<8){const to=rr*8+ff;if(color(this.board[to])===this.turn)break;add(from,to,null,this.board[to]?'c':'');if(this.board[to])break;rr+=dr;ff+=df;}}}
    } return moves;
  }
  castleMoves(from:number, add:(from:number,to:number,promotion?:string|null,flags?:string)=>void):void {
    const white=this.turn==='w', base=white?60:4, enemy=white?'b':'w'; if(from!==base||this.inCheck())return;
    const king=white?'K':'k', rook=white?'R':'r'; if(this.board[from]!==king)return;
    if(this.castling.includes(white?'K':'k')&&this.board[base+3]===rook&&!this.board[base+1]&&!this.board[base+2]&&!this.attacked(base+1,enemy)&&!this.attacked(base+2,enemy))add(from,base+2,null,'k');
    if(this.castling.includes(white?'Q':'q')&&this.board[base-4]===rook&&!this.board[base-1]&&!this.board[base-2]&&!this.board[base-3]&&!this.attacked(base-1,enemy)&&!this.attacked(base-2,enemy))add(from,base-2,null,'q');
  }
  moves():Move[] { return this.pseudo().filter(m=>{const snapshot=this.snapshot();this.apply(m);const bad=this.inCheck(this.turn==='w'?'b':'w');this.restore(snapshot);return !bad;}); }
  snapshot():PositionSnapshot{return {board:[...this.board],turn:this.turn,castling:this.castling,ep:this.ep,halfmove:this.halfmove,fullmove:this.fullmove};}
  restore(s:PositionSnapshot):void{Object.assign(this,s);}
  apply(m:Move):void{const p=this.board[m.from]! as Piece, side=this.turn, captured=this.board[m.to];this.board[m.to]=(m.promotion?(side==='w'?m.promotion.toUpperCase():m.promotion):p) as Piece;this.board[m.from]=null;
    if(m.flags.includes('e'))this.board[m.to+(side==='w'?8:-8)]=null;
    if(m.flags==='k'){this.board[m.to-1]=this.board[m.to+1];this.board[m.to+1]=null;} if(m.flags==='q'){this.board[m.to+1]=this.board[m.to-2];this.board[m.to-2]=null;}
    const rights:Record<number,string>={0:'q',4:'kq',7:'k',56:'Q',60:'KQ',63:'K'};for(const sq of [m.from,m.to])if(rights[sq])for(const x of rights[sq])this.castling=this.castling.replace(x,'');
    this.ep=m.flags==='d'?(m.from+m.to)/2:-1;this.halfmove=(p.toUpperCase()==='P'||captured||m.flags.includes('e'))?0:this.halfmove+1;if(side==='b')this.fullmove++;this.turn=side==='w'?'b':'w';
  }
  san(m:Move, legal:Move[]=this.moves()):string {const p=this.board[m.from]!, type=p.toUpperCase();if(m.flags==='k')return'O-O';if(m.flags==='q')return'O-O-O';let s=type==='P'?'':type;
    if(type!=='P'){const same=legal.filter(x=>x!==m&&x.to===m.to&&this.board[x.from]?.toUpperCase()===type);if(same.length){if(same.every(x=>x.from%8!==m.from%8))s+=FILES[m.from%8];else if(same.every(x=>Math.floor(x.from/8)!==Math.floor(m.from/8)))s+=8-Math.floor(m.from/8);else s+=squareName(m.from);}}
    if(m.flags.includes('c')||m.flags.includes('e'))s+=(type==='P'?FILES[m.from%8]:'')+'x';s+=squareName(m.to);if(m.promotion)s+='='+m.promotion.toUpperCase();const snap=this.snapshot();this.apply(m);if(this.inCheck()){s+=this.moves().length?'#'.replace('#','+'):'#';}this.restore(snap);return s;
  }
  play(input:string):string {const legal=this.moves(), normalized=input.trim().replace(/[!?+#]/g,'').replace(/0/g,'O');let move=legal.find(m=>`${squareName(m.from)}${squareName(m.to)}${m.promotion||''}`===normalized.toLowerCase());if(!move)move=legal.find(m=>this.san(m,legal).replace(/[+#]/g,'')===normalized);if(!move)throw new Error(`Illegal or unrecognized move: ${input}`);const san=this.san(move,legal), before=this.snapshot();this.apply(move);this.history.push({move,san,before});return san;}
  undo():HistoryEntry|undefined{const h=this.history.pop();if(h)this.restore(h.before);return h;}
  status():string|null{const moves=this.moves();if(!moves.length)return this.inCheck()?(this.turn==='w'?'Black':'White')+' wins by checkmate':'Draw by stalemate';if(this.halfmove>=100)return'Draw by fifty-move rule';return null;}
}
