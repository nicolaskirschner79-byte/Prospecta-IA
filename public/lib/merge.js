import {normalizeText} from './domain.js';
import {contactLinks} from './contacts.js';
const value=(b,key)=>normalizeText(b.fields?.[key]?.value).replace(/[^a-z0-9]+/g,' ').trim();
export function needsContactRefresh(businesses,input){return businesses.length>0&&businesses.every(b=>b.providerId?.startsWith('osm-')&&!contactLinks(b).length&&value(b,'city')===normalizeText(input.city)&&value(b,'uf')===normalizeText(input.uf));}
export function sameBusiness(a,b){
  if(a.id===b.id)return true;
  if(!['name','city','uf'].every(key=>value(a,key)&&value(a,key)===value(b,key)))return false;
  if(value(a,'address')&&value(a,'address')===value(b,'address'))return true;
  const x=a.location,y=b.location;
  if(![x?.lat,x?.lon,y?.lat,y?.lon].every(Number.isFinite))return false;
  const meters=Math.hypot((x.lat-y.lat)*111000,(x.lon-y.lon)*111000*Math.cos(x.lat*Math.PI/180));
  return meters<100;
}
export function mergePublished(existing,incoming){
  if(!sameBusiness(existing,incoming))return null;
  const next=structuredClone(existing);let changed=false;
  const sourceIds=new Set();
  for(const [key,fresh]of Object.entries(incoming.fields||{})){
    const current=next.fields[key];
    if(fresh.value&&(!current?.value||current.status==='missing')){next.fields[key]=structuredClone(fresh);sourceIds.add(fresh.sourceId);changed=true;}
  }
  if(!changed)return {business:existing,changed:false};
  for(const source of incoming.sources||[])if(sourceIds.has(source.id)&&!next.sources.some(s=>s.id===source.id))next.sources.push(structuredClone(source));
  next.providerId=incoming.providerId;next.providerMeta=structuredClone(incoming.providerMeta);next.location=structuredClone(incoming.location);
  if(next.segment==='other')next.segment=incoming.segment;
  next.updatedAt=new Date().toISOString();next.events.unshift({at:next.updatedAt,text:'Contatos e campos ausentes preenchidos com uma fonte pública associada à mesma unidade. Dados já preenchidos foram preservados.'});
  return {business:next,changed:true};
}
