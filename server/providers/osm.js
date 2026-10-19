import { newBusiness, field, clean, safeURL, SEGMENTS } from '../../public/lib/domain.js';
import { AppError,limitedJSON } from '../security.js';
const UF={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
export const OSM_TAGS={beauty:[['shop','hairdresser|beauty']],health:[['amenity','clinic|doctors|dentist']],food:[['amenity','restaurant|cafe|fast_food']],fashion:[['shop','clothes|fashion|shoes|jewelry']],vehicles:[['shop','car|motorcycle']],auto:[['shop','car_repair|tyres']],estate:[['office','estate_agent']],construction:[['office','architect|construction_company|engineer']],fitness:[['leisure','fitness_centre|sports_centre']],pets:[['shop','pet'],['amenity','veterinary']],accounting:[['office','accountant']],market:[['shop','supermarket|convenience|greengrocer']],furniture:[['shop','furniture|interior_decoration']],education:[['amenity','school|language_school|music_school|training']],other:[['shop','.+'],['office','.+']]};
const quoted=s=>JSON.stringify(s);
export function buildQuery({city,uf,segments=[],query='',district=''}){
  city=clean(city,80);uf=clean(uf,2).toUpperCase();
  if(city.length<2||!UF[uf])throw new AppError(400,'INPUT','Informe cidade e UF válidas.');
  if(segments.length>15||segments.some(k=>!OSM_TAGS[k]))throw new AppError(400,'INPUT','Segmento inválido.');
  const tags=segments.length?segments.flatMap(k=>OSM_TAGS[k]):[['shop','.+'],['office','.+'],['amenity','restaurant|cafe|fast_food|clinic|doctors|dentist|veterinary|school|language_school|training'],['leisure','fitness_centre|sports_centre']];
  // Nome/palavra-chave e bairro são filtros literais locais. Não interpolar regex fornecida pelo usuário.
  return `[out:json][timeout:20][maxsize:33554432];area["ISO3166-2"=${quoted('BR-'+uf)}]["admin_level"="4"]->.state;rel["boundary"="administrative"]["admin_level"="8"]["name"=${quoted(city)}](area.state);map_to_area->.city;(${tags.map(([k,v])=>`nwr[${quoted(k)}~${quoted('^('+v+')$')}]["name"](area.city);`).join('')});out tags center 100;`;
}
function segmentFor(tags){return Object.entries(OSM_TAGS).find(([s,rules])=>s!=='other'&&rules.some(([k,v])=>new RegExp(`^(${v})$`).test(tags[k]||'')))?.[0]||'other';}
export function normalizeOSM(element,{city,uf}){
  if(!['node','way','relation'].includes(element.type)||!Number.isSafeInteger(element.id)||!element.tags?.name)return null;
  const t=element.tags,now=new Date().toISOString(),s={id:`osm-${element.type}-${element.id}`,label:'© OpenStreetMap contributors',url:`https://www.openstreetmap.org/${element.type}/${element.id}`,license:'ODbL 1.0 — atribuição e obrigações de compartilhamento aplicáveis',collectedAt:now,expiresAt:new Date(Date.now()+30*86400000).toISOString(),permissions:{retain:true,export:true,ai:true}};
  const b=newBusiness({name:t.name,city:t['addr:city']||city,uf,segment:segmentFor(t),district:t['addr:suburb'],address:[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),website:safeURL(t.website||t['contact:website'])||'',phone:t.phone||t['contact:phone'],email:t.email||t['contact:email'],hours:t.opening_hours,social:safeURL(t['contact:instagram']||t['contact:facebook'])||''},s);
  b.id=s.id;b.providerId=s.id;
  Object.values(b.fields).forEach(f=>{f.status=f.value?'verified':'missing';});
  // Área pesquisada não é endereço publicado quando a tag addr:city não existe.
  if(!t['addr:city'])b.fields.city={...b.fields.city,status:'inference',value:city};
  b.fields.uf={...b.fields.uf,status:'inference'};
  b.assessments.digital={...field('inconclusive',s.id),reason:'O cadastro do OpenStreetMap, isoladamente, não confirma ausência de site nem associação do domínio.',status:'inference'};
  b.providerNotice='Dados colaborativos; confirmar identidade, atualidade, domínio e canais diretamente com o comércio. A ausência de website na fonte não significa ausência de site.';
  return b;
}
export class OSMProvider{
  constructor({contact,fetcher=fetch}){this.contact=contact;this.fetcher=fetcher;}
  async search(input){
    const q=buildQuery(input);
    const response=await this.fetcher('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:q}),headers:{'User-Agent':`ProspectaIA/1.0 (${this.contact})`},signal:AbortSignal.timeout(25000)});
    if(response.status===429)throw new AppError(429,'LIMIT','Limite da fonte atingido. Aguarde antes de tentar novamente.');
    if(!response.ok)throw new AppError(503,'UNAVAILABLE','A fonte OpenStreetMap está indisponível. Use cadastro/importação ou tente mais tarde.');
    const data=await limitedJSON(response);
    if(!Array.isArray(data.elements))throw new AppError(502,'UPSTREAM_FORMAT','A fonte não retornou uma lista válida.');
    const fold=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const result=data.elements.map(e=>normalizeOSM(e,input)).filter(Boolean).filter(b=>!input.query||fold(Object.values(b.fields).map(f=>f.value).join(' ')+' '+SEGMENTS[b.segment]).includes(fold(input.query))).filter(b=>!input.district||fold(b.fields.district.value).includes(fold(input.district)));
    return {state:data.remark?'partial':'available',businesses:result.slice(0,50),nextCursor:null,partial:true,notice:'Amostra limitada: até 100 objetos da fonte e 50 resultados exibidos. Palavra-chave e bairro filtram essa amostra. Não representa todos os comércios da cidade.',attribution:'© OpenStreetMap contributors — ODbL 1.0',licenseURL:'https://www.openstreetmap.org/copyright'};
  }
  async details(id){
    const m=/^osm-(node|way|relation)-(\d+)$/.exec(id);if(!m)throw new AppError(400,'INPUT','Identificador de fonte inválido.');
    const response=await this.fetcher('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:`[out:json][timeout:15];${m[1]}(${m[2]});out tags center;`}),headers:{'User-Agent':`ProspectaIA/1.0 (${this.contact})`},signal:AbortSignal.timeout(20000)});
    if(response.status===429)throw new AppError(429,'LIMIT','Limite da fonte atingido.');if(!response.ok)throw new AppError(503,'UNAVAILABLE','Fonte indisponível.');
    const data=await limitedJSON(response);if(!Array.isArray(data.elements)||!data.elements[0])throw new AppError(404,'NOT_FOUND','Registro não localizado na fonte.');
    return {business:normalizeOSM(data.elements[0],{city:'',uf:''}),state:'available'};
  }
}
