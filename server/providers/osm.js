import { newBusiness, field, clean, safeURL, SEGMENTS, normalizeText } from '../../public/lib/domain.js';
import { AppError,limitedJSON } from '../security.js';
import { MUNICIPALITIES } from '../data/municipalities.js';
import { STATES as UF } from '../../public/lib/regions.js';
export const OSM_TAGS={beauty:[['shop','hairdresser|beauty']],health:[['amenity','clinic|doctors|dentist']],food:[['amenity','restaurant|cafe|fast_food']],fashion:[['shop','clothes|fashion|shoes|jewelry']],vehicles:[['shop','car|motorcycle']],auto:[['shop','car_repair|tyres']],estate:[['office','estate_agent']],construction:[['office','architect|construction_company|engineer']],fitness:[['leisure','fitness_centre|sports_centre']],pets:[['shop','pet'],['amenity','veterinary']],accounting:[['office','accountant']],market:[['shop','supermarket|convenience|greengrocer']],furniture:[['shop','furniture|interior_decoration']],education:[['amenity','school|language_school|music_school|training']],other:[['shop','.+'],['office','.+']]};
const quoted=s=>JSON.stringify(s);
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const caches=new WeakMap();
export function buildQuery({city,uf,segments=[],query='',district=''}){
  city=clean(city,80);uf=clean(uf,2).toUpperCase();
  if(city.length<2||!UF[uf])throw new AppError(400,'INPUT','Informe cidade e UF válidas.');
  if(!Array.isArray(segments)||segments.length>15||segments.some(k=>typeof k!=='string'||!Object.hasOwn(OSM_TAGS,k)))throw new AppError(400,'INPUT','Segmento inválido.');
  const code=MUNICIPALITIES[uf]?.[normalizeText(city).replace(/\s+/g,' ')];
  if(!Number.isSafeInteger(code))throw new AppError(400,'INPUT','Cidade não localizada nesta UF. Informe o nome completo do município, sem bairro.');
  const tags=segments.length?[...new Set(segments)].sort().flatMap(k=>OSM_TAGS[k]):[['shop','.+'],['office','.+'],['amenity','restaurant|cafe|fast_food|clinic|doctors|dentist|veterinary|school|language_school|training'],['leisure','fitness_centre|sports_centre']];
  const area=uf==='DF'?'area["ISO3166-2"="BR-DF"]["admin_level"="4"]->.city;':`(area["IBGE:GEOCODIGO"=${quoted(String(code))}]["admin_level"="8"];area["ref:IBGE"=${quoted(String(code))}]["admin_level"="8"];)->.city;`;
  const filter=(k,v)=>v==='.+'?`[${quoted(k)}]`:v.includes('|')?`[${quoted(k)}~${quoted('^('+v+')$')}]`:`[${quoted(k)}=${quoted(v)}]`;
  return `[out:json][timeout:6][maxsize:16777216];${area}(${tags.map(([k,v])=>`nwr${filter(k,v)}["name"](area.city);`).join('')});out tags center 100;`;
}
function segmentFor(tags){return Object.entries(OSM_TAGS).find(([s,rules])=>s!=='other'&&rules.some(([k,v])=>new RegExp(`^(${v})$`).test(tags[k]||'')))?.[0]||'other';}
export function normalizeOSM(element,{city,uf,collectedAt}){
  if(!['node','way','relation'].includes(element.type)||!Number.isSafeInteger(element.id)||!element.tags?.name)return null;
  const t=element.tags,now=collectedAt||new Date().toISOString(),s={id:`osm-${element.type}-${element.id}`,label:'© OpenStreetMap contributors',url:`https://www.openstreetmap.org/${element.type}/${element.id}`,license:'ODbL 1.0 — atribuição e obrigações de compartilhamento aplicáveis',collectedAt:now,expiresAt:new Date(Date.parse(now)+30*86400000).toISOString(),permissions:{retain:true,export:true,ai:true}};
  const b=newBusiness({name:t.name,city:t['addr:city']||city,uf,segment:segmentFor(t),district:t['addr:suburb'],address:[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),website:safeURL(t.website||t['contact:website'])||'',phone:t.phone||t['contact:phone'],email:t.email||t['contact:email'],hours:t.opening_hours,social:safeURL(t['contact:instagram']||t['contact:facebook'])||''},s);
  b.id=s.id;b.providerId=s.id;
  Object.values(b.fields).forEach(f=>{f.status=f.value?'verified':'missing';f.observedAt=now;f.verifiedAt=now;});
  // Área pesquisada não é endereço publicado quando a tag addr:city não existe.
  if(!t['addr:city'])b.fields.city={...b.fields.city,status:'inference',value:city};
  b.fields.uf={...b.fields.uf,status:'inference'};
  b.assessments.digital={...field('inconclusive',s.id),observedAt:now,verifiedAt:now,reason:'O cadastro do OpenStreetMap, isoladamente, não confirma ausência de site nem associação do domínio.',status:'inference'};
  b.providerNotice='Dados colaborativos; confirmar identidade, atualidade, domínio e canais diretamente com o comércio. A ausência de website na fonte não significa ausência de site.';
  return b;
}
export class OSMProvider{
  constructor({contact,fetcher=fetch,requestTimeoutMs=7000,now=Date.now,maxAttempts=2}){this.contact=contact;this.fetcher=fetcher;this.requestTimeoutMs=requestTimeoutMs;this.now=now;this.maxAttempts=maxAttempts;}
  async transport(endpoint,query){
    const controller=new AbortController();let timer;
    const work=(async()=>{
      const response=await this.fetcher(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':`ProspectaIA/1.1 (${this.contact})`},signal:controller.signal});
      if(response.status===429){await response.body?.cancel();throw new AppError(429,'LIMIT','Limite da fonte atingido. Aguarde antes de tentar novamente.');}
      if(!response.ok){await response.body?.cancel();throw new AppError(503,'UNAVAILABLE','Fonte OpenStreetMap indisponível.');}
      const data=await limitedJSON(response);
      if(!Array.isArray(data.elements))throw new AppError(502,'UPSTREAM_FORMAT','A fonte não retornou uma lista válida.');
      if(data.remark&&!data.elements.length)throw new AppError(504,'TIMEOUT','A fonte esgotou o tempo sem concluir a consulta.');
      return {data,collectedAt:new Date(this.now()).toISOString()};
    })();
    try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppError(504,'TIMEOUT','A fonte demorou para responder. Tente novamente em alguns instantes.'));},this.requestTimeoutMs);})]);}
    finally{clearTimeout(timer);controller.abort();}
  }
  async request(query){
    let state=caches.get(this.fetcher);if(!state){state={entries:new Map(),preferred:0,cooldowns:[0,0]};caches.set(this.fetcher,state);}
    const {entries}=state,now=this.now();
    for(const [key,item]of entries)if(!item.pending&&item.staleUntil<=now)entries.delete(key);
    let item=entries.get(query);
    if(item?.value&&item.freshUntil>now)return {...structuredClone(item.value),cache:'fresh'};
    if(item?.pending)return structuredClone(await item.pending);
    if(!item){item={freshUntil:0,staleUntil:0,value:null,pending:null};entries.set(query,item);}
    const stale=()=>item.value&&item.staleUntil>this.now()?{...structuredClone(item.value),cache:'stale'}:null;
    const promise=(async()=>{
      let last=new AppError(503,'UNAVAILABLE','As fontes estão temporariamente indisponíveis. Aguarde alguns instantes.');
      const order=[state.preferred,1-state.preferred].filter(index=>state.cooldowns[index]<=this.now()).slice(0,this.maxAttempts);
      for(const index of order){
        try{
          const value=await this.transport(ENDPOINTS[index],query);
          state.preferred=index;state.cooldowns[index]=0;item.value=value;
          item.freshUntil=this.now()+600000;item.staleUntil=this.now()+12*3600000;
          return {...structuredClone(value),cache:'miss'};
        }catch(error){
          last=error;
          if(error.code==='LIMIT'){state.cooldowns=[this.now()+30000,this.now()+30000];break;}
          if(error.code==='UPSTREAM_FORMAT'||error.code==='UPSTREAM_SIZE')break;
          state.cooldowns[index]=this.now()+60000;
        }
      }
      const previous=stale();if(previous)return previous;
      throw last;
    })();
    item.pending=promise;
    if(entries.size>12){for(const [key,entry]of entries)if(key!==query&&!entry.pending){entries.delete(key);break;}}
    try{return structuredClone(await promise);}finally{item.pending=null;if(!item.value)entries.delete(query);}
  }
  async search(input){
    const q=buildQuery(input);
    const {data,collectedAt,cache}=await this.request(q);
    const fold=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const result=data.elements.map(e=>normalizeOSM(e,{...input,collectedAt})).filter(Boolean).filter(b=>!input.query||fold(Object.values(b.fields).map(f=>f.value).join(' ')+' '+SEGMENTS[b.segment]).includes(fold(input.query))).filter(b=>!input.district||fold(b.fields.district.value).includes(fold(input.district)));
    const notice=result.length?'Amostra limitada: até 100 objetos da fonte e 50 resultados exibidos. Palavra-chave e bairro filtram essa amostra. Não representa todos os comércios da cidade.':'Nenhum resultado nesta amostra. Tente retirar palavra-chave, bairro ou segmentos; confira a cidade e UF. A cobertura do OpenStreetMap é parcial.';
    return {state:data.remark||cache==='stale'?'partial':'available',businesses:result.slice(0,50),collectedAt,cache,nextCursor:null,partial:true,notice:(cache==='stale'?`Fonte indisponível agora. Exibindo consulta salva em ${new Date(collectedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}. `:'')+notice,attribution:'© OpenStreetMap contributors — ODbL 1.0',licenseURL:'https://www.openstreetmap.org/copyright'};
  }
  async details(id){
    const m=/^osm-(node|way|relation)-(\d+)$/.exec(id);if(!m)throw new AppError(400,'INPUT','Identificador de fonte inválido.');
    const {data,collectedAt}=await this.request(`[out:json][timeout:15];${m[1]}(${m[2]});out tags center;`);
    if(!data.elements[0])throw new AppError(404,'NOT_FOUND','Registro não localizado na fonte.');
    return {business:normalizeOSM(data.elements[0],{city:'',uf:'',collectedAt}),state:'available'};
  }
}
