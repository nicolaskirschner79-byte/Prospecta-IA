import {PbfWriter} from 'pbf';
import {zxyToTileId} from 'pmtiles';
import {tileFor} from '../server/providers/overture.js';
import {photonCity} from './fixtures-photon.js';
export function overtureFeature(extra={}){
  return {type:'Feature',geometry:{type:'Point',coordinates:[-48.88,-23.98]},properties:{id:'11111111-1111-4111-8111-111111111111','@name':'Café do fluxo de teste',names:JSON.stringify({primary:'Café do fluxo de teste'}),
    basic_category:'restaurant',taxonomy:JSON.stringify({primary:'cafe',hierarchy:['food','restaurant']}),confidence:.98,
    addresses:JSON.stringify([{country:'BR',region:'SP',locality:'Itapeva',freeform:'Rua de Teste, 123'}]),
    phones:JSON.stringify(['+551500000000']),emails:JSON.stringify(['contato@example.invalid']),socials:JSON.stringify(['https://www.facebook.com/test-fixture']),
    sources:JSON.stringify([{dataset:'test',provider:'test',license:'CDLA-Permissive-2.0',update_time:'2026-10-01T00:00:00Z'}]),...extra}};
}
function vectorBytes(features){
  const keys=[],values=[],records=[];
  for(const feature of features){const tags=[];for(const [key,value]of Object.entries(feature.properties)){
    if(value===undefined||value===null)continue;let index=keys.indexOf(key);if(index<0){index=keys.length;keys.push(key);}tags.push(index,values.length);values.push(value);
  }records.push(tags);}
  const writer=new PbfWriter();
  writer.writeMessage(3,(_unused,p)=>{
    p.writeStringField(1,'place');p.writeVarintField(15,2);p.writeVarintField(5,4096);
    for(const tags of records)p.writeMessage(2,(tags,f)=>{f.writePackedVarint(2,tags);f.writeVarintField(3,1);f.writePackedVarint(4,[9,4096,4096]);},tags);
    for(const key of keys)p.writeStringField(3,key);
    for(const value of values)p.writeMessage(4,(v,f)=>{if(typeof v==='number')f.writeDoubleField(3,v);else f.writeStringField(1,String(v));},value);
  },null);
  return writer.finish();
}
export function overtureArchive(features=[overtureFeature()]){
  const tile=tileFor(-48.8803886,-23.9849105),data=vectorBytes(features),directory=new PbfWriter();
  for(const value of [1,zxyToTileId(tile.z,tile.x,tile.y),1,data.length,1])directory.writeVarint(value);
  const index=directory.finish(),header=new Uint8Array(127),view=new DataView(header.buffer);
  header.set(new TextEncoder().encode('PMTiles'),0);header[7]=3;
  const set=(offset,value)=>view.setBigUint64(offset,BigInt(value),true);
  set(8,127);set(16,index.length);set(56,127+index.length);set(64,data.length);set(72,1);set(80,1);set(88,1);
  header[96]=1;header[97]=1;header[98]=1;header[99]=1;header[100]=14;header[101]=14;
  const archive=new Uint8Array(header.length+index.length+data.length);archive.set(header);archive.set(index,127);archive.set(data,127+index.length);return archive;
}
export function overtureTransport(features=[overtureFeature()]){
  const archive=overtureArchive(features);
  return async(url,options={})=>{
    if(new URL(String(url)).hostname==='photon.komoot.io')return Response.json({features:[photonCity('Minas Gerais'),photonCity()]});
    if(new URL(String(url)).hostname!=='tiles.overturemaps.org')throw new Error('Fonte inesperada: '+url);
    const match=/^bytes=(\d+)-(\d+)$/.exec(options.headers?.Range||'');if(!match)throw new Error('Faixa obrigatória');
    const start=Number(match[1]),end=Math.min(Number(match[2]),archive.length-1);
    return new Response(archive.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${archive.length}`,etag:'"fixture"'}});
  };
}
