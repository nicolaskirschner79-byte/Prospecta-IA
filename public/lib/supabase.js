let config=null, session=null, refreshing=null;
const storageKey=()=>`prospecta.auth.v1:${config?.url}`;
function rememberSession(){try{if(session)sessionStorage.setItem(storageKey(),JSON.stringify(session));else sessionStorage.removeItem(storageKey());}catch{/* Em modo privado, a sessão continua funcionando em memória. */}}
export function clearSession(){session=null;rememberSession();}
export function configureSupabase(c){
  config=c?.url&&c?.key?c:null;session=null;
  try{const saved=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(config&&saved?.access_token&&saved?.refresh_token&&saved?.user?.id&&Number.isFinite(saved.expires_at))session=saved;}catch{/* Sessão ausente/corrompida não impede o espaço local. */}
}
export function authSession(){return session;}
async function call(path,options={}){
  if(!config)throw new Error('Supabase não configurado.');
  const headers={apikey:config.key,'Content-Type':'application/json',...options.headers};
  if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  const r=await fetch(`${config.url}${path}`,{...options,headers,signal:AbortSignal.timeout(15000)});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{throw new Error('Resposta inválida do banco.');}
  if(!r.ok){const error=new Error(data?.msg||data?.message||data?.error_description||'Falha de autenticação ou banco.');error.status=r.status;throw error;}
  return data;
}
export async function login(email,password){
  const data=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  session={...data,expires_at:Date.now()+data.expires_in*1000};
  // sessionStorage preserva a conta ao recarregar esta aba, sem localStorage.
  rememberSession();
  return session;
}
export async function register(email,password){if(password.length<12)throw new Error('Use uma senha de pelo menos 12 caracteres para criar a conta.');return call('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});}
export async function ensureSession(){
  if(session && session.expires_at<Date.now()+60000){
    if(!refreshing){const previous=session;refreshing=(async()=>{try{const r=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:previous.refresh_token})});if(session===previous){session={...r,expires_at:Date.now()+r.expires_in*1000};rememberSession();}}catch(error){if(session===previous&&(error.status===400||error.status===401))clearSession();throw error;}finally{refreshing=null;}})();}
    await refreshing;
  }
  return session;
}
export async function logout(){try{if(session)await call('/auth/v1/logout',{method:'POST'});}catch{/* Encerrar a sessão local mesmo quando o servidor estiver indisponível. */}finally{clearSession();}}
export async function loadCloud(){
  await ensureSession();
  const [rows,profiles]=await Promise.all([call('/rest/v1/businesses?select=id,data,updated_at&order=updated_at.desc&limit=1000'),call('/rest/v1/profiles?select=settings&limit=1')]);
  return {businesses:rows.map(r=>r.data),settings:profiles[0]?.settings||null,truncated:rows.length===1000};
}
export async function saveCloud(b){
  await ensureSession();if(!session)throw new Error('Entre na sua conta para salvar.');
  await call('/rest/v1/businesses?on_conflict=user_id,id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:b.id,user_id:session.user.id,data:b,updated_at:new Date().toISOString()})});
}
export async function saveCloudBatch(businesses){
  await ensureSession();if(!session)throw new Error('Entre na sua conta para salvar.');
  if(!businesses.length)return;
  const updated_at=new Date().toISOString();
  await call('/rest/v1/businesses?on_conflict=user_id,id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(businesses.map(b=>({id:b.id,user_id:session.user.id,data:b,updated_at})))});
}
export async function deleteCloud(id){await ensureSession();return call(`/rest/v1/businesses?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});}
export async function saveCloudSettings(settings){await ensureSession();return call('/rest/v1/profiles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:session.user.id,settings})});}
