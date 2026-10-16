declare const process: { env: Record<string,string|undefined>; stdout: { isTTY?: boolean; write(value:string):void } };
declare module 'node:process' { export const stdin: unknown; export const stdout: { isTTY?:boolean; write(value:string):void }; }
declare module 'node:readline/promises' { export function createInterface(options:unknown): { question(prompt:string):Promise<string>; close():void }; }
declare module 'node:child_process' {
  interface Child { stdin:{write(value:string):void}; stdout:unknown; on(event:string, listener:(error:Error)=>void):void }
  export function spawn(command:string,args:string[],options:unknown):Child;
}
declare module 'node:readline' { export function createInterface(options:unknown): { on(event:string,listener:(line:string)=>void):void }; }
