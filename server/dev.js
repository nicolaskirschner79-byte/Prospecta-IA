import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,extname } from 'node:path';
import { handleAPI } from './handler.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8'};
export function createApp(env=process.env){return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  if(req.url.startsWith('/api/')){await handleAPI(req,res,env);return;}
  try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';
    const path=resolve(root,'.'+pathname);if(!path.startsWith(root)||!types[extname(path)]){res.writeHead(404);res.end('Não encontrado');return;}
    res.setHeader('Content-Type',types[extname(path)]);res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Não encontrado');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT)||3000;createApp().listen(port,'127.0.0.1',()=>console.log(`Prospecta IA: http://localhost:${port}`));}
