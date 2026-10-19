import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
if(!existsSync(new URL('./node_modules/pmtiles/package.json',import.meta.url))){
  console.log('Preparando as dependências da busca…');
  execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev'],{cwd:new URL('.',import.meta.url),stdio:'inherit',shell:process.platform==='win32'});
}
