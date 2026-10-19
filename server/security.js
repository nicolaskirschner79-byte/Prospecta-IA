import dns from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
export class AppError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
export function publicIP(ip){
  if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));}
  if(isIP(ip)===6){const v=ip.toLowerCase(),parts=v.split(':');return /^[23][\da-f]{0,3}:/.test(v)&&!(parts[0]==='2001'&&(parseInt(parts[1]||'0',16)<=0x1ff||parts[1]==='db8'))&&!v.startsWith('2002:')&&!v.startsWith('3fff:');}
  return false;
}
export function validateAuditURL(raw,allowedHosts=[]){
  let u;try{u=new URL(raw);}catch{throw new AppError(400,'INVALID_URL','URL inválida.');}
  const h=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||isIP(h)||!h.includes('.')||h.endsWith('.'))throw new AppError(400,'UNSAFE_URL','Informe um domínio HTTPS público, sem porta ou credenciais.');
  if(!allowedHosts.includes(h))throw new AppError(403,'DOMAIN_NOT_ALLOWED','Domínio não autorizado para auditoria. Configure AUDIT_ALLOWED_HOSTS com autorização do responsável.');
  u.hash='';return u;
}
export async function safeGet(raw,{allowedHosts,lookup=dns.lookup,maxBytes=700000,redirects=3,timeout=8000,signal}={}){
  signal?.throwIfAborted();
  const u=validateAuditURL(raw,allowedHosts);
  const addresses=await lookup(u.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw new AppError(400,'UNSAFE_DNS','O domínio resolve para endereço reservado ou privado.');
  const pinned=addresses[0];
  const result=await new Promise((resolve,reject)=>{
    const req=https.get(u,{signal,headers:{'User-Agent':'ProspectaIA/1.0 (auditoria autorizada)','Accept':'text/html,text/plain;q=0.5','Accept-Encoding':'identity'},lookup:(_host,opts,cb)=>opts?.all?cb(null,[pinned]):cb(null,pinned.address,pinned.family)},res=>{
      let size=0,chunks=[];
      const type=String(res.headers['content-type']||'');
      if(!res.statusCode || res.statusCode>=300&&res.statusCode<400){res.resume();resolve({status:res.statusCode,headers:res.headers,body:'',url:u.href});return;}
      if(!/^(text\/html|text\/plain)/i.test(type)){res.destroy();reject(new AppError(422,'CONTENT_TYPE','A página não é HTML ou texto.'));return;}
      res.on('data',c=>{size+=c.length;if(size>maxBytes){res.destroy();reject(new AppError(422,'TOO_LARGE','Resposta acima do limite de auditoria.'));}else chunks.push(c);});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8'),url:u.href}));
      res.on('error',reject);
    });
    const timer=setTimeout(()=>req.destroy(new AppError(504,'TIMEOUT','Tempo limite na análise.')),timeout);
    req.on('close',()=>clearTimeout(timer));req.on('error',reject);
  });
  if(result.status>=300&&result.status<400){
    if(!redirects||!result.headers.location)throw new AppError(422,'REDIRECT_LIMIT','Redirecionamento não analisável.');
    return safeGet(new URL(result.headers.location,u).href,{allowedHosts,lookup,maxBytes,redirects:redirects-1,timeout,signal});
  }
  return result;
}
export function equalSecret(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);}
const buckets=new Map();let inFlight=0;
export function rateLimit(key,now=Date.now()){
  for(const [k,v]of buckets)if(now-v.at>3600000)buckets.delete(k);
  if(buckets.size>=2000&&!buckets.has(key))throw new AppError(429,'LIMIT','Limite temporário atingido.');
  let b=buckets.get(key);if(!b||now-b.at>3600000)b={at:now,count:0,last:0};
  if(b.count>=30||now-b.last<3000)throw new AppError(429,'LIMIT','Aguarde entre consultas; limite de 30 operações externas por hora e instância.');
  b.count++;b.last=now;buckets.set(key,b);
}
export async function bounded(fn){if(inFlight>=2)throw new AppError(429,'BUSY','Análises em andamento. Tente novamente em alguns instantes.');inFlight++;try{return await fn();}finally{inFlight--;}}
export async function limitedJSON(res,max=1500000){
  const reader=res.body?.getReader();if(!reader)throw new AppError(502,'UPSTREAM','Resposta vazia da fonte.');
  let bytes=0, chunks=[];while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw new AppError(502,'UPSTREAM_SIZE','Resposta da fonte acima do limite.');}chunks.push(Buffer.from(value));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(502,'UPSTREAM_FORMAT','Formato de resposta da fonte inválido.');}
}
