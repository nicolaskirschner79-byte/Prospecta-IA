import { newBusiness, field, clean, safeURL, SEGMENTS } from '../../public/lib/domain.js';
import { AppError,limitedJSON } from '../security.js';
const UF={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
export const OSM_TAGS={beauty:[['shop','hairdresser|beauty']],health:[['amenity','clinic|doctors|dentist']],food:[['amenity','restaurant|cafe|fast_food']],fashion:[['shop','clothes|fashion|shoes|jewelry']],vehicles:[['shop','car|motorcycle']],auto:[['shop','car_repair|tyres']],estate:[['office','estate_agent']],construction:[['office','architect|construction_company|engineer']],fitness:[['leisure','fitness_centre|sports_centre']],pets:[['shop','pet'],['amenity','veterinary']],accounting:[['office','accountant']],market:[['shop','supermarket|convenience|greengrocer']],furniture:[['shop','furniture|interior_decoration']],education:[['amenity','school|language_school|music_school|training']],other:[['shop','.+'],['office','.+']]};
const quoted=s=>JSON.stringify(s);
const cityPattern=value=>'^'+value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[aeioucn]/g,c=>({a:'[aáàâãä]',e:'[eéèêë]',i:'[iíìîï]',o:'[oóòôõö]',u:'[uúùûü]',c:'[cç]',n:'[nñ]'}[c]))+'$';
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const caches=new WeakMap();
export function buildQuery({city,uf,segments=[],query='',district=''}){
  city=clean(city,80);uf=clean(uf,2).toUpperCase();
  if(city.length<2||!UF[uf])throw new AppError(400,'INPUT','Informe cidade e UF válidas.');
  if(segments.length>15||segments.some(k=>!OSM_TAGS[k]))throw new AppError(400,'INPUT','Segmento inválido.');
  const tags=segments.length?segments.flatMap(k=>OSM_TAGS[k]):[['shop','.+'],['office','.+'],['amenity','restaurant|cafe|fast_food|clinic|doctors|dentist|veterinary|school|language_school|training'],['leisure','fitness_centre|sports_centre']];
  // Nome/palavra-chave e bairro são filtros literais locais. Não interpolar regex fornecida pelo usuário.
  const area=uf==='DF'?'.state->.city;':`rel["boundary"="administrative"]["admin_level"="8"]["name"~${quoted(cityPattern(city))},i](area.state);map_to_area->.city;`;
  return `[out:json][timeout:18][maxsize:33554432];area["ISO3166-2"=${quoted('BR-'+uf)}]["admin_level"="4"]->.state;${area}(${tags.map(([k,v])=>`nwr[${quoted(k)}~${quoted('^('+v+')$')}]["name"](area.city);`).join('')});out tags center 100;`;
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
  constructor({contact,fetcher=fetch}){this.contact=contact;this.fetcher=fetcher;}
  async request(query){
    let cache=caches.get(this.fetcher);if(!cache){cache=new Map();caches.set(this.fetcher,cache);}
    for(const [key,item]of cache)if(item.expires<Date.now())cache.delete(key);
    if(cache.has(query))return structuredClone(await cache.get(query).promise);
    const promise=(async()=>{
      for(let i=0;i<ENDPOINTS.length;i++){
        try{
          const response=await this.fetcher(ENDPOINTS[i],{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':`ProspectaIA/1.0 (${this.contact})`},signal:AbortSignal.timeout(20000)});
          // Respeitar o limite explícito: não trocar de servidor para contornar 429.
          if(response.status===429)throw new AppError(429,'LIMIT','Limite da fonte atingido. Aguarde antes de tentar novamente.');
          if(!response.ok){await response.body?.cancel();throw new AppError(503,'UNAVAILABLE','Fonte OpenStreetMap indisponível. Tente mais tarde.');}
          const data=await limitedJSON(response);
          if(!Array.isArray(data.elements))throw new AppError(502,'UPSTREAM_FORMAT','A fonte não retornou uma lista válida.');
          return {data,collectedAt:new Date().toISOString()};
        }catch(error){
          if(error.code==='LIMIT'||error.code==='UPSTREAM_FORMAT'||error.code==='UPSTREAM_SIZE')throw error;
          if(i===ENDPOINTS.length-1)throw new AppError(503,'UNAVAILABLE','As fontes OpenStreetMap estão indisponíveis. Seus registros continuam salvos; tente mais tarde.');
        }
      }
    })();
    if(cache.size>=12)cache.delete(cache.keys().next().value);
    cache.set(query,{promise,expires:Date.now()+300000});
    try{return structuredClone(await promise);}catch(error){cache.delete(query);throw error;}
  }
  async search(input){
    const q=buildQuery(input);
    const {data,collectedAt}=await this.request(q);
    const fold=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const result=data.elements.map(e=>normalizeOSM(e,{...input,collectedAt})).filter(Boolean).filter(b=>!input.query||fold(Object.values(b.fields).map(f=>f.value).join(' ')+' '+SEGMENTS[b.segment]).includes(fold(input.query))).filter(b=>!input.district||fold(b.fields.district.value).includes(fold(input.district)));
    return {state:data.remark?'partial':'available',businesses:result.slice(0,50),collectedAt,nextCursor:null,partial:true,notice:result.length?'Amostra limitada: até 100 objetos da fonte e 50 resultados exibidos. Palavra-chave e bairro filtram essa amostra. Não representa todos os comércios da cidade.':'Nenhum resultado nesta amostra. Tente retirar palavra-chave, bairro ou segmentos; confira a cidade e UF. A cobertura do OpenStreetMap é parcial.',attribution:'© OpenStreetMap contributors — ODbL 1.0',licenseURL:'https://www.openstreetmap.org/copyright'};
  }
  async details(id){
    const m=/^osm-(node|way|relation)-(\d+)$/.exec(id);if(!m)throw new AppError(400,'INPUT','Identificador de fonte inválido.');
    const {data,collectedAt}=await this.request(`[out:json][timeout:15];${m[1]}(${m[2]});out tags center;`);
    if(!data.elements[0])throw new AppError(404,'NOT_FOUND','Registro não localizado na fonte.');
    return {business:normalizeOSM(data.elements[0],{city:'',uf:'',collectedAt}),state:'available'};
  }
}
