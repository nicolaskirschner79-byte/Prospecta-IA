import { normalizeText } from './domain.js';

const caches=new WeakMap();
export function searchKey(input){
  return JSON.stringify({city:normalizeText(input.city).replace(/\s+/g,' '),uf:String(input.uf||'').trim().toUpperCase(),segments:[...new Set(input.segments||[])].sort(),query:normalizeText(input.query),district:normalizeText(input.district)});
}

export async function searchBusinesses(input,{signal,fetcher=fetch,now=Date.now,timeoutMs=18000}={}){
  signal?.throwIfAborted();
  let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}
  const key=searchKey(input),saved=cache.get(key);
  if(saved&&now()-saved.at<600000)return {...structuredClone(saved.data),browserCache:true};
  const controller=new AbortController();let timedOut=false,abortListener;
  const stop=()=>controller.abort(signal?.reason);
  signal?.addEventListener('abort',stop,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    const work=(async()=>{
      const canonical=JSON.parse(key),params=new URLSearchParams({...canonical,city:String(input.city||'').trim().replace(/\s+/g,' '),segments:canonical.segments.join(','),v:'3'});
      const response=await fetcher('/api/search?'+params,{method:'GET',signal:controller.signal});
      let data;try{data=await response.json();}catch{throw new Error('O servidor não retornou uma resposta válida. Tente novamente.');}
      if(!response.ok){const error=new Error(data.message||'Não foi possível consultar a fonte agora.');error.status=response.status;throw error;}
      if(!Array.isArray(data.businesses))throw new Error('Resposta de busca inválida.');
      if(response.headers?.get('x-vercel-cache')==='STALE'||Date.parse(data.collectedAt)<now()-600000){
        data={...data,state:'partial',cache:'stale',notice:`Consulta salva em ${new Date(data.collectedAt).toLocaleString('pt-BR')}. Atualização da fonte pendente. ${data.notice||''}`};
      }
      return data;
    })();
    const data=await Promise.race([work,new Promise((_,reject)=>{
      abortListener=()=>reject(new DOMException('Busca interrompida.','AbortError'));
      if(controller.signal.aborted)abortListener();else controller.signal.addEventListener('abort',abortListener,{once:true});
    })]);
    // Não estender a validade de uma resposta de contingência a cada consulta.
    if(data.cache!=='stale'){
      if(cache.size>=8&&!cache.has(key))cache.delete(cache.keys().next().value);
      const collected=Date.parse(data.collectedAt);
      cache.set(key,{data:structuredClone(data),at:Number.isFinite(collected)?Math.min(now(),collected):now()});
    }
    return data;
  }catch(error){
    if(signal?.aborted)throw new DOMException('Busca cancelada.','AbortError');
    if(saved&&now()-saved.at<12*3600000&&(!error.status||error.status>=500||error.status===429)){
      return {...structuredClone(saved.data),state:'partial',cache:'stale',browserCache:true,notice:`A fonte não respondeu agora. Exibindo a última busca salva, de ${new Date(saved.data.collectedAt||saved.at).toLocaleString('pt-BR')}. ${saved.data.notice||''}`};
    }
    if(timedOut)throw new Error('A fonte não respondeu em até 18 segundos. Seus registros foram preservados. Tente novamente em alguns instantes.');
    throw error;
  }finally{
    clearTimeout(timer);signal?.removeEventListener('abort',stop);
    if(abortListener)controller.signal.removeEventListener('abort',abortListener);
    controller.abort();
  }
}
