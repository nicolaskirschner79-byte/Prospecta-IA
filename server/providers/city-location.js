import {STATES} from '../../public/lib/regions.js';
import {normalizeText} from '../../public/lib/domain.js';
import {AppError,limitedJSON} from '../security.js';
import {buildQuery} from './osm.js';
const caches=new WeakMap();
export async function cityLocation(input,{fetcher=fetch,contact,signal,now=Date.now}={}){
  buildQuery(input);const city=input.city.trim(),uf=input.uf.trim().toUpperCase(),key=uf+'|'+normalizeText(city);
  let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}
  if(cache.blockedUntil>now())throw new AppError(429,'LIMIT','A localização está em pausa temporária. Aguarde para tentar novamente.');
  const saved=cache.get(key);if(saved&&now()-saved.at<86400000)return saved;
  const params=new URLSearchParams({q:city,countrycode:'BR',layer:'city',limit:'10'});
  const r=await fetcher('https://photon.komoot.io/api/?'+params,{headers:{'User-Agent':`ProspectaIA/1.3 (${contact})`},signal});
  if(!r.ok){await r.body?.cancel();if(r.status===429)cache.blockedUntil=now()+60000;throw new AppError(r.status===429?429:503,r.status===429?'LIMIT':'UNAVAILABLE','Não foi possível localizar o município agora.');}
  const data=await limitedJSON(r);
  const feature=data.features?.find(f=>{const p=f?.properties||{};return normalizeText(p.name)===normalizeText(city)&&String(p.countrycode).toUpperCase()==='BR'&&[normalizeText(STATES[uf]),normalizeText(uf)].includes(normalizeText(p.state));});
  const extent=feature?.properties?.extent,coordinates=feature?.geometry?.coordinates;
  if(!Array.isArray(extent)||extent.length!==4||!extent.every(Number.isFinite)||extent[0]>=extent[2]||extent[3]>=extent[1]||Math.abs(extent[0])>180||Math.abs(extent[2])>180||Math.abs(extent[1])>90||Math.abs(extent[3])>90)throw new AppError(503,'AREA_UNAVAILABLE','A área do município não está disponível na fonte.');
  const center=Array.isArray(coordinates)&&coordinates.length>=2&&coordinates.slice(0,2).every(Number.isFinite)?coordinates.slice(0,2):[(extent[0]+extent[2])/2,(extent[1]+extent[3])/2];
  const location={center,bbox:[extent[0],extent[3],extent[2],extent[1]],at:now()};
  if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,location);return location;
}
