import type { Chess } from '@check/chess';
const GLYPHS:Record<string,string>={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
interface RenderOptions { perspective?:'w'|'b'; last?:number[]|null; color?:boolean }
export function render(chess:Chess,{perspective='w',last=null,color=Boolean(process.stdout.isTTY)}:RenderOptions={}):string{
  const rows=perspective==='w'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0], files=perspective==='w'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];let out='';
  for(const r of rows){out+=` ${8-r} `;for(const f of files){const i=r*8+f,p=chess.board[i],dark=(r+f)%2;let cell=` ${p?(GLYPHS[p]||p):' '} `;if(color)cell=`\x1b[${last?.includes(i)?'43':dark?'100':'47'};${p&&p===p.toLowerCase()?'30':'97'}m${cell}\x1b[0m`;else cell=dark?`[${p?GLYPHS[p]||p:' '}]`:cell;out+=cell;}out+='\n';}out+='    '+files.map(f=>` ${'abcdefgh'[f]} `).join('')+'\n';return out;
}
