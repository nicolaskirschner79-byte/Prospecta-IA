import { STATES } from '../../public/lib/regions.js';
import { normalizeText,SEGMENTS } from '../../public/lib/domain.js';
import { AppError,limitedJSON } from '../security.js';
import { OSM_TAGS,normalizeOSM,buildQuery } from './osm.js';
import {cityLocation} from './city-location.js';

const caches=new WeakMap();
const fold=value=>normalizeText(value).replace(/\s+/g,' ');
const defaultRules=[['shop','.+'],['office','.+'],['amenity','restaurant|cafe|fast_food|clinic|doctors|dentist|veterinary|school|language_school|training'],['leisure','fitness_centre|sports_centre']];
export function photonCategories(segments=[]){
  const rules=segments.length?[...new Set(segments)].flatMap(key=>OSM_TAGS[key]):defaultRules;
  return [...new Set(rules.flatMap(([key,values])=>values==='.+'?[`osm.${key}`]:values.split('|').map(value=>`osm.${key}.${value}`)))].join(',');
}
export function sameCity(properties,input){
  return String(properties.countrycode||'').toUpperCase()==='BR'&&
    [fold(STATES[input.uf]),fold(input.uf)].includes(fold(properties.state))&&
    fold(properties.city)===fold(input.city);
}
export function normalizePhoton(feature,input,collectedAt){
  const p=feature?.properties,type={N:'node',W:'way',R:'relation'}[p?.osm_type];
  if(!p||!type||!Number.isSafeInteger(p.osm_id)||!p.name||!sameCity(p,input))return null;
  const rules=input.segments?.length?input.segments.flatMap(key=>OSM_TAGS[key]):defaultRules;
  if(!rules.some(([key,value])=>key===p.osm_key&&new RegExp(`^(${value})$`).test(p.osm_value||'')))return null;
  const extra=p.extra||{},tags={name:p.name,[p.osm_key]:p.osm_value,'addr:city':p.city,'addr:suburb':p.district||p.locality,'addr:street':p.street,'addr:housenumber':p.housenumber};
  for(const key of ['phone','email','website','opening_hours','contact:phone','contact:email','contact:website','contact:instagram','contact:facebook'])if(typeof extra[key]==='string')tags[key]=extra[key];
  const business=normalizeOSM({type,id:p.osm_id,tags},{...input,collectedAt});
  business.sources[0].label='© OpenStreetMap contributors · índice Photon';
  business.providerNotice='Registro do índice Photon/OpenStreetMap. Confirme os dados com a empresa; contatos ausentes não foram estimados. A amostra não representa todos os comércios do município.';
  return business;
}

export class PhotonProvider{
  constructor({contact,fetcher=fetch,timeoutMs=7000,now=Date.now}){this.contact=contact;this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.now=now;}
  async json(path,params,signal){
    const response=await this.fetcher(`https://photon.komoot.io/${path}?${params}`,{headers:{'User-Agent':`ProspectaIA/1.2 (${this.contact})`},signal});
    if(response.status===429){await response.body?.cancel();throw new AppError(429,'LIMIT','A fonte atingiu seu limite temporário. Aguarde antes de tentar novamente.');}
    if(!response.ok){await response.body?.cancel();throw new AppError(503,'UNAVAILABLE','O índice de comércios está indisponível agora.');}
    const data=await limitedJSON(response);
    if(!Array.isArray(data.features))throw new AppError(502,'UPSTREAM_FORMAT','O índice retornou uma resposta inválida.');
    return data.features;
  }
  async search(raw){
    buildQuery(raw);const input={...raw,city:raw.city.trim(),uf:raw.uf.trim().toUpperCase()};
    let state=caches.get(this.fetcher);if(!state){state={cities:new Map(),searches:new Map(),pending:new Map(),blockedUntil:0};caches.set(this.fetcher,state);}
    const cityKey=input.uf+'|'+fold(input.city),key=cityKey+'|'+[...new Set(input.segments||[])].sort().join(',');
    const saved=state.searches.get(key);let sample;
    if(saved&&this.now()-saved.at<600000)sample={...saved,cache:'fresh'};
    else if(state.pending.has(key))sample=await state.pending.get(key);
    else{
      const controller=new AbortController();let timer;
      const work=(async()=>{
        if(state.blockedUntil>this.now())throw new AppError(429,'LIMIT','A fonte está em pausa temporária. Aguarde para pesquisar novamente.');
        const area=await cityLocation(input,{fetcher:this.fetcher,contact:this.contact,signal:controller.signal,now:this.now}),location={bbox:area.bbox.join(',')};
        const params=new URLSearchParams({bbox:location.bbox,include:photonCategories(input.segments),limit:'50',countrycode:'BR'});
        const features=await this.json('api/',params,controller.signal);
        const value={features,collectedAt:new Date(this.now()).toISOString(),at:this.now(),cache:'miss'};
        if(controller.signal.aborted)throw new AppError(504,'TIMEOUT','A fonte demorou para responder.');
        if(state.searches.size>=24)state.searches.delete(state.searches.keys().next().value);state.searches.set(key,value);return value;
      })();
      const pending=(async()=>{
        try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppError(504,'TIMEOUT','O índice de comércios demorou para responder.'));},this.timeoutMs);})]);}
        catch(error){
          if(error.code==='LIMIT')state.blockedUntil=this.now()+30000;
          if(saved&&this.now()-saved.at<12*3600000)return {...saved,cache:'stale'};throw error;
        }finally{clearTimeout(timer);controller.abort();}
      })();
      state.pending.set(key,pending);
      try{sample=await pending;}finally{state.pending.delete(key);}
    }
    const records=sample.features.map(feature=>normalizePhoton(feature,input,sample.collectedAt)).filter(Boolean);
    const businesses=records.filter(b=>!input.query||fold(Object.values(b.fields).map(f=>f.value).join(' ')+' '+SEGMENTS[b.segment]).includes(fold(input.query))).filter(b=>!input.district||fold(b.fields.district.value).includes(fold(input.district)));
    return {state:'partial',provider:'photon',businesses,collectedAt:sample.collectedAt,cache:sample.cache,nextCursor:null,partial:true,notice:(sample.cache==='stale'?'Fonte indisponível agora; exibindo a última consulta salva. ':'')+`Amostra do índice Photon/OpenStreetMap: ${businesses.length} registros encontrados para ${input.city}/${input.uf}. Até 50 candidatos; cidade, estado, segmento, palavra-chave e bairro são conferidos. A cobertura é parcial e contatos ausentes precisam de verificação.`,attribution:'© OpenStreetMap contributors — ODbL 1.0',licenseURL:'https://www.openstreetmap.org/copyright'};
  }
}
