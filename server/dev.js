import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,extname } from 'node:path';
import { spawn } from 'node:child_process';
import { handleAPI } from './handler.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8'};
export function createApp(env=process.env){return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  if(req.url.startsWith('/api/')){await handleAPI(req,res,env);return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Método não permitido');return;}
  try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';
    const path=resolve(root,'.'+pathname);if(!path.startsWith(root)||!types[extname(path)]){res.writeHead(404);res.end('Não encontrado');return;}
    const content=await readFile(path);res.setHeader('Content-Type',types[extname(path)]);res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404);res.end('Não encontrado');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT)||3000;
  createApp().listen(port,'127.0.0.1',()=>{
    const url=`http://localhost:${port}`;console.log(`Prospecta IA: ${url}`);
    if(process.argv.includes('--open')){
      const [command,args]=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
      const browser=spawn(command,args,{stdio:'ignore',detached:true});browser.on('error',()=>console.log('Abra o endereço acima no navegador.'));browser.unref();
    }
  });
}
