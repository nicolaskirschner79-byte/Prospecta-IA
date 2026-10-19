import { AppError,equalSecret,rateLimit,bounded,limitedJSON } from './security.js';
import { OSMProvider } from './providers/osm.js';
import { auditWebsite } from './audit.js';
import { resolveConfig } from './config.js';
export function publicConfig(input={}){const env=resolveConfig(input);return {search:env.ENABLE_OSM==='true'&&env.PROVIDER_CONTACT?'available':'not_configured',audit:env.AUDIT_MODE!=='disabled'?'available':'not_configured',ai:'template',supabase:env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY?{url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY}:null,access:env.APP_ACCESS_KEY?'access_key':env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY?'supabase':'not_configured'};}
async function authenticate(req,env){
  if(env.APP_ACCESS_KEY&&equalSecret(req.headers['x-access-key'],env.APP_ACCESS_KEY))return 'single-user';
  const bearer=req.headers.authorization;
  if(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY&&bearer?.startsWith('Bearer ')){
    const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer},signal:AbortSignal.timeout(5000)});
    if(r.ok){const data=await limitedJSON(r,20000);if(data.id)return data.id;}
    throw new AppError(401,'INVALID_CREDENTIAL','Sessão inválida ou expirada. Entre novamente.');
  }
  if(!env.APP_ACCESS_KEY&&!env.SUPABASE_URL)throw new AppError(503,'NOT_CONFIGURED','Acesso às consultas externas não configurado. Cadastro e importação continuam disponíveis.');
  throw new AppError(401,'UNAUTHORIZED','Entre na conta ou informe o código de acesso às integrações.');
}
export async function handleAPI(req,res,input=process.env){
  const env=resolveConfig(input);
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  try{
    const route=new URL(req.url,'http://localhost').pathname.split('/').at(-1);
    if(route==='config'&&req.method==='GET'){res.end(JSON.stringify(publicConfig(env)));return;}
    if(!['search','details','audit'].includes(route))throw new AppError(404,'NOT_FOUND','Rota não encontrada.');
    if(req.method!=='POST')throw new AppError(405,'METHOD','Método não permitido.');
    const user=await authenticate(req,env);rateLimit(user);
    if(user!=='single-user'){
      const quota=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/consume_api_quota`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:req.headers.authorization,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
      if(!quota.ok)throw new AppError(503,'QUOTA_UNAVAILABLE','Não foi possível reservar a quota no banco. Verifique a instalação do schema.');
      if(await limitedJSON(quota,1000)!==true)throw new AppError(429,'LIMIT','Limite por conta atingido. Aguarde antes de tentar novamente.');
    }
    let body=req.body;
    if(typeof body==='string'){if(Buffer.byteLength(body)>16000)throw new AppError(413,'SIZE','Requisição muito grande.');try{body=JSON.parse(body);}catch{throw new AppError(400,'INPUT','JSON inválido.');}}
    if(!body){let s='';for await(const c of req){s+=c;if(Buffer.byteLength(s)>16000)throw new AppError(413,'SIZE','Requisição muito grande.');}try{body=JSON.parse(s);}catch{throw new AppError(400,'INPUT','JSON inválido.');}}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new AppError(400,'INPUT','Objeto JSON esperado.');
    if(Buffer.byteLength(JSON.stringify(body))>16000)throw new AppError(413,'SIZE','Requisição muito grande.');
    let result;
    if(route==='search'||route==='details'){
      if(env.ENABLE_OSM!=='true'||!env.PROVIDER_CONTACT)throw new AppError(503,'NOT_CONFIGURED','Fonte de busca não configurada.');
      const provider=new OSMProvider({contact:env.PROVIDER_CONTACT});
      if(route==='search'){
        if(typeof body.city!=='string'||typeof body.uf!=='string'||(body.segments&&!Array.isArray(body.segments))||typeof(body.query||'')!=='string'||typeof(body.district||'')!=='string'||(body.query||'').length>100||(body.district||'').length>80)throw new AppError(400,'INPUT','Parâmetros de busca inválidos.');
        result=await bounded(()=>provider.search(body));
      }else result=await bounded(()=>provider.details(String(body.id||'')));
    }else if(route==='audit'){
      if(env.AUDIT_MODE==='disabled')throw new AppError(503,'NOT_CONFIGURED','Auditoria desativada nesta instalação.');
      if(typeof body.url!=='string'||body.url.length>2000||body.authorized!==true)throw new AppError(400,'INPUT','Confirme autorização para analisar o domínio.');
      result=await bounded(()=>auditWebsite(body.url,env));
    }else throw new AppError(404,'NOT_FOUND','Rota não encontrada.');
    res.end(JSON.stringify(result));
  }catch(e){const expected=e instanceof AppError;res.statusCode=expected?e.status:e.name==='TimeoutError'?504:502;res.end(JSON.stringify({state:expected?e.code==='LIMIT'?'limit':e.code==='INVALID_CREDENTIAL'?'invalid_credential':e.code==='NOT_CONFIGURED'?'not_configured':'unavailable':'unavailable',code:expected?e.code:'UPSTREAM_ERROR',message:expected?e.message:'Não foi possível concluir a consulta externa. Nenhum resultado foi fabricado.'}));}
}
