import {PMTiles} from 'pmtiles';
import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import {newBusiness,normalizeText,safeURL,SEGMENTS} from '../../public/lib/domain.js';
import {phoneNumber,emailAddress,websiteKind} from '../../public/lib/contacts.js';
import {STATES} from '../../public/lib/regions.js';
import {AppError} from '../security.js';
import {cityLocation} from './city-location.js';
import {buildQuery} from './osm.js';

export const OVERTURE_RELEASE='2026-09-23.1';
const states=new WeakMap(),z=14;
const fold=text=>normalizeText(text).replace(/\s+/g,' ');
const unpack=(raw,fallback)=>{try{return typeof raw==='string'?JSON.parse(raw):raw??fallback;}catch{return fallback;}};
const list=raw=>{const data=unpack(raw,[]);return Array.isArray(data)?data:[];};
const licenses=new Set(['CDLA-Permissive-2.0','CC0-1.0','Apache-2.0','CC-BY-4.0','ODbL-1.0']);
const licenseLinks={'CDLA-Permissive-2.0':'https://cdla.dev/permissive-2-0/','CC0-1.0':'https://creativecommons.org/publicdomain/zero/1.0/','Apache-2.0':'https://www.apache.org/licenses/LICENSE-2.0','CC-BY-4.0':'https://creativecommons.org/licenses/by/4.0/','ODbL-1.0':'https://opendatacommons.org/licenses/odbl/1-0/'};
export function tileFor(lon,lat){const n=2**z;return {z,x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)};}
export function overtureSegment(properties){
  const taxonomy=unpack(properties.taxonomy,{})||{},tags=[properties.basic_category,taxonomy.primary,...(Array.isArray(taxonomy.hierarchy)?taxonomy.hierarchy:[])].filter(Boolean).join(' ');
  const rules=[['pets',/animal|pet_|veterinar/],['vehicles',/auto_dealer|car_dealer|motorcycle_dealer|vehicle_dealer/],['auto',/automotive_service|auto_repair|tire_|car_repair|vehicle_parts/],['beauty',/beauty_service|hair|barber|nail_salon|spa\b/],['health',/health_care|clinic|dentist|dental|medical|physician|pharmacy/],['food',/restaurant|eatery|cafe|coffee_shop|bakery|bar\b|food_truck/],['fashion',/fashion|apparel|shoe|clothing|jewelry/],['estate',/real_estate/],['construction',/architect|construction|building_service|engineering|home_builder/],['fitness',/gym\b|fitness|pilates|yoga|sports_club/],['accounting',/accounting|accountant|tax_preparation/],['market',/grocery|supermarket|convenience|food_and_beverage_store/],['furniture',/furniture|interior_design|home_furnishing/],['education',/school|education|place_of_learning|training/]];
  return rules.find(([,test])=>test.test(tags))?.[0]||'other';
}
export function normalizeOverture(feature,input,collectedAt,release=OVERTURE_RELEASE){
  const p=feature?.properties||{},id=p.id,coords=feature?.geometry?.coordinates;
  if(!/^[a-f\d-]{36}$/i.test(id||'')||!Array.isArray(coords)||coords.length!==2||!coords.every(Number.isFinite))return null;
  const addresses=list(p.addresses),address=addresses.find(a=>a?.country==='BR'&&fold(a.locality)===fold(input.city)&&[fold(input.uf),fold('BR-'+input.uf),fold(STATES[input.uf])].includes(fold(a.region)));
  if(!address)return null;
  const sources=list(p.sources);if(!sources.length||sources.some(s=>!licenses.has(s?.license)))return null;
  const taxonomy=unpack(p.taxonomy,{})||{},category=taxonomy.primary||p.basic_category||'';
  if(/place_of_worship|religious_organization|government_office|cemetery|bus_stop|police_station/.test(category))return null;
  const names=unpack(p.names,{})||{},name=names.primary||p['@name'];if(typeof name!=='string'||!name.trim())return null;
  const confidence=Number(p.confidence);if(!Number.isFinite(confidence)||confidence<.6)return null;
  const segment=overtureSegment(p),phones=list(p.phones),emails=list(p.emails),sites=list(p.websites),socials=list(p.socials);
  const phone=phones.map(phoneNumber).find(Boolean)||'',email=emails.map(emailAddress).find(Boolean)||'';
  const website=sites.map(raw=>safeURL(raw)).find(url=>url&&websiteKind(url)==='website')||'';
  const social=[...socials,...sites].map(raw=>safeURL(raw)).find(url=>url&&websiteKind(url)==='platform')||'';
  const whatsapp=[...socials,...sites].map(raw=>safeURL(raw)).find(url=>url&&new URL(url).hostname==='wa.me'&&phoneNumber('+'+new URL(url).pathname.slice(1)))||'';
  const collected=new Date(collectedAt).toISOString(),expiresAt=new Date(Date.parse(collected)+30*86400000).toISOString();
  const source={id:'overture-'+id,label:'Overture Maps · '+[...new Set(sources.map(s=>s.provider||s.dataset))].filter(Boolean).join(', '),url:'https://explore.overturemaps.org/',recordId:id,
    license:[...new Set(sources.map(s=>s.license))].map(name=>name+' — '+licenseLinks[name]).join(' · '),collectedAt:collected,expiresAt,permissions:{retain:true,export:true,ai:true}};
  const b=newBusiness({name,city:address.locality,uf:input.uf,segment,address:address.freeform||'',phone,email,website,social,whatsapp},source);
  b.id=source.id;b.providerId=source.id;b.location={lon:coords[0],lat:coords[1]};
  for(const f of Object.values(b.fields)){f.status=f.value?'verified':'missing';f.observedAt=collected;f.verifiedAt=collected;}
  if(whatsapp)b.fields.whatsapp.published=true;
  b.providerMeta={provider:'overture',release,category,confidence,updatedAt:sources.map(s=>s.update_time).filter(Boolean).sort().at(-1)||null,operatingStatus:p.operating_status||null};
  if(p.operating_status==='permanently_closed')b.lifecycle='closed';
  b.providerNotice='Contatos publicados no catálogo Overture Maps; confirme atualidade e vínculo antes da abordagem. Telefone não é convertido em WhatsApp. Site ausente no catálogo não comprova ausência de site.';
  return b;
}

function shared(fetcher,contact){
  let state=states.get(fetcher);if(state)return state;
  const url=`https://tiles.overturemaps.org/${OVERTURE_RELEASE}/places.pmtiles`;
  const source={getKey:()=>url,async getBytes(offset,length,signal){
    if(!Number.isSafeInteger(offset)||offset<0||length>8000000)throw new AppError(502,'UPSTREAM_SIZE','Recorte de dados acima do limite.');
    const response=await fetcher(url,{headers:{Range:`bytes=${offset}-${offset+length-1}`,'User-Agent':`ProspectaIA/1.3 (${contact})`},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(6000)]):AbortSignal.timeout(6000)});
    if(response.status===429){await response.body?.cancel();throw new AppError(429,'LIMIT','A fonte atingiu o limite temporário. Aguarde para consultar novamente.');}
    if(response.status!==206){await response.body?.cancel();throw new AppError(503,'UNAVAILABLE','O catálogo complementar não está disponível agora.');}
    const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');
    if(!range||Number(range[1])!==offset||Number(range[2])-offset+1>length){await response.body?.cancel();throw new AppError(502,'UPSTREAM_FORMAT','O catálogo retornou um recorte inválido.');}
    const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>length){await reader.cancel();throw new AppError(502,'UPSTREAM_SIZE','A resposta excedeu o recorte solicitado.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
    return {data:bytes.buffer,etag:response.headers.get('etag')||undefined};
  }};
  state={reader:new PMTiles(source),tiles:new Map(),pending:new Map(),blockedUntil:0};states.set(fetcher,state);return state;
}
export async function readOvertureTile(tile,{fetcher=fetch,contact,signal,now=Date.now}={}){
  const state=shared(fetcher,contact),key=`${tile.x}/${tile.y}`,saved=state.tiles.get(key);
  if(saved&&now()-saved.at<3600000)return saved;
  if(state.blockedUntil>now())throw new AppError(429,'LIMIT','O catálogo está em pausa temporária.');
  if(state.pending.has(key))return state.pending.get(key);
  const pending=(async()=>{
    try{
      const tileData=await state.reader.getZxy(tile.z,tile.x,tile.y,signal),features=[];
      if(tileData){
        const vector=new VectorTile(new PbfReader(new Uint8Array(tileData.data)));
        for(const layer of Object.values(vector.layers))for(let i=0;i<Math.min(layer.length,10000);i++)features.push(layer.feature(i).toGeoJSON(tile.x,tile.y,tile.z));
      }
      const value={features,collectedAt:new Date(now()).toISOString(),at:now()};
      if(state.tiles.size>=8)state.tiles.delete(state.tiles.keys().next().value);state.tiles.set(key,value);return value;
    }catch(error){if(error.code==='LIMIT')state.blockedUntil=now()+60000;throw error;}
  })();state.pending.set(key,pending);
  try{return await pending;}finally{state.pending.delete(key);}
}
export class OvertureProvider{
  constructor({contact,fetcher=fetch,tileReader=readOvertureTile,now=Date.now,timeoutMs=13000}={}){Object.assign(this,{contact,fetcher,tileReader,now,timeoutMs});}
  async search(raw){
    buildQuery(raw);const input={...raw,city:raw.city.trim(),uf:raw.uf.trim().toUpperCase()};
    const controller=new AbortController();let timer;
    const work=(async()=>{
      const options={fetcher:this.fetcher,contact:this.contact,signal:controller.signal,now:this.now};
      const area=await cityLocation(input,options),center=tileFor(...area.center),tiles=[center];
      const features=[];let collectedAt;
      const consume=async tile=>{const value=await this.tileReader(tile,options);features.push(...value.features);if(!collectedAt||value.collectedAt<collectedAt)collectedAt=value.collectedAt;};
      await consume(center);
      const matches=()=>features.map(f=>normalizeOverture(f,input,collectedAt)).filter(Boolean).filter(b=>!input.segments?.length||input.segments.includes(b.segment)).filter(b=>!input.query||fold([b.fields.name.value,b.fields.address.value,SEGMENTS[b.segment],b.providerMeta.category].join(' ')).includes(fold(input.query))).filter(b=>!input.district||fold(b.fields.address.value).includes(fold(input.district)));
      let businesses=matches();
      if(businesses.length<50){
        for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])tiles.push({...center,x:center.x+dx,y:center.y+dy});
        const more=await Promise.allSettled(tiles.slice(1).map(consume));
        const limited=more.find(r=>r.status==='rejected'&&r.reason?.code==='LIMIT');if(limited)throw limited.reason;
        businesses=matches();
      }
      const unique=[...new Map(businesses.map(b=>[b.id,b])).values()];
      const distance=b=>(b.location.lon-area.center[0])**2+(b.location.lat-area.center[1])**2;
      const result=unique.filter(b=>b.lifecycle==='active').sort((a,b)=>distance(a)-distance(b)).slice(0,50);
      if(!result.length)throw new AppError(503,'NO_COVERAGE','O catálogo não tem cobertura suficiente neste recorte.');
      if(controller.signal.aborted)throw new AppError(504,'TIMEOUT','Tempo limite do catálogo.');
      return {state:'partial',provider:'overture',businesses:result,collectedAt,cache:this.now()-Date.parse(collectedAt)>1000?'fresh':'miss',partial:true,nextCursor:null,
        notice:`${result.length} registros do catálogo Overture Maps na área central de ${input.city}/${input.uf}. Amostra parcial; telefones, e-mails e sites são os publicados na fonte. Confirme a atualidade antes de abordar.`,attribution:'Overture Maps Foundation · atribuições e licenças por registro',licenseURL:'https://docs.overturemaps.org/attribution/'};
    })();
    try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppError(504,'TIMEOUT','O catálogo complementar demorou para responder.'));},this.timeoutMs);})]);}
    finally{clearTimeout(timer);controller.abort();}
  }
  async details(input){
    if(!/^overture-[a-f\d-]{36}$/i.test(input.id||''))throw new AppError(400,'INPUT','Identificador inválido.');
    if(!Number.isFinite(input.location?.lon)||!Number.isFinite(input.location?.lat)||Math.abs(input.location.lon)>180||Math.abs(input.location.lat)>85)throw new AppError(400,'INPUT','Atualize a busca para localizar este registro.');
    buildQuery(input);
    const controller=new AbortController();let timer,result;
    try{result=await Promise.race([this.tileReader(tileFor(input.location.lon,input.location.lat),{fetcher:this.fetcher,contact:this.contact,signal:controller.signal,now:this.now}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppError(504,'TIMEOUT','O catálogo demorou para atualizar este registro.'));},7000);})]);}
    finally{clearTimeout(timer);controller.abort();}
    const feature=result.features.find(f=>'overture-'+f.properties?.id===input.id),business=feature&&normalizeOverture(feature,input,result.collectedAt);
    if(!business)throw new AppError(404,'NOT_FOUND','Registro não localizado no catálogo.');
    return {state:'partial',business};
  }
}
