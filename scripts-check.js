import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function walk(dir){const out=[];for(const f of await readdir(dir,{withFileTypes:true})){if(f.name.startsWith('.')||f.name==='node_modules')continue;const p=dir+'/'+f.name;if(f.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=await walk('.');let failed=false;
for(const p of files.filter(p=>p.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);failed=true;}}
const html=await readFile('public/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]*)"/g)){try{await readFile('public'+match[1]);}catch{console.error('Ativo ausente:',match[1]);failed=true;}}
for(const p of ['package.json','vercel.json'])JSON.parse(await readFile(p,'utf8'));
console.log(`${files.filter(p=>p.endsWith('.js')).length} módulos JavaScript verificados; ativos HTML e JSON conferidos.`);
process.exitCode=failed?1:0;
