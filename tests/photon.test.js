import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotonProvider,normalizePhoton,photonCategories} from '../server/providers/photon.js';
import {BusinessProvider} from '../server/providers/businesses.js';
import {photonCity,photonBusiness,photonResponse} from './fixtures-photon.js';
const input={city:'Itapeva',uf:'SP',segments:[]};

test('Photon resolve homônimos pela UF, consulta bbox na ordem correta e usa categorias em OR',async()=>{
  const calls=[];const fetcher=async url=>{calls.push(new URL(url));return photonResponse(url);};
  const result=await new PhotonProvider({contact:'test',fetcher}).search(input);
  assert.equal(result.businesses.length,1);assert.equal(result.provider,'photon');assert.equal(result.partial,true);
  assert.equal(calls.length,2);assert.equal(calls[0].searchParams.get('layer'),'city');
  assert.equal(calls[1].searchParams.get('bbox'),'-49.2,-24.2,-48.5,-23.5');
  assert.equal(calls[1].searchParams.getAll('include').length,1);assert.match(calls[1].searchParams.get('include'),/osm.shop,osm.office/);
  assert.ok(calls.every(url=>url.origin==='https://photon.komoot.io'));
  assert.match(photonCategories(['pets']),/osm.shop.pet,osm.amenity.veterinary/);
});

test('Photon exclui outra cidade, UF, país, localidade incerta e categoria fora do segmento',()=>{
  const at='2026-10-19T00:00:00Z';assert.ok(normalizePhoton(photonBusiness(),input,at));
  for(const props of [{city:'Ribeirão Branco'},{state:'Minas Gerais'},{countrycode:'PT'},{city:undefined},{osm_key:'highway',osm_value:'residential'}])assert.equal(normalizePhoton(photonBusiness(props),input,at),null);
  assert.equal(normalizePhoton(photonBusiness(),{...input,segments:['beauty']},at),null);
  const business=normalizePhoton(photonBusiness(),input,at);
  for(const key of ['phone','whatsapp','website','email'])assert.equal(business.fields[key].value,'');
  assert.equal(business.assessments.digital.value,'inconclusive');assert.match(business.sources[0].label,/Photon/);
});

test('cache Photon reaproveita amostra para palavra-chave sem alterar objetos nem data original',async()=>{
  let now=Date.now(),calls=0,offline=false;
  const fetcher=async url=>{calls++;return offline?new Response('',{status:503}):photonResponse(url);};
  const p=new PhotonProvider({contact:'test',fetcher,now:()=>now});
  const first=await p.search(input);first.businesses[0].fields.name.value='Edição';
  const fresh=await p.search({...input,query:'cafe'});assert.equal(calls,2);assert.equal(fresh.cache,'fresh');assert.equal(fresh.businesses[0].fields.name.value,'Café do fluxo de teste');
  assert.equal((await p.search({...input,district:'Bairro inexistente'})).businesses.length,0);
  now+=600001;offline=true;const stale=await p.search(input);
  assert.equal(stale.cache,'stale');assert.equal(stale.collectedAt,first.collectedAt);assert.match(stale.notice,/consulta salva/);
  now+=12*3600000;await assert.rejects(()=>p.search(input),e=>e.code==='UNAVAILABLE');
});

test('prazo Photon inclui corpo travado e fetch que ignora cancelamento',async()=>{
  for(const stalledBody of [false,true]){
    let signal;
    const p=new PhotonProvider({contact:'test',timeoutMs:10,fetcher:async(_url,options)=>{signal=options.signal;return stalledBody?new Response(new ReadableStream({start(){}})):new Promise(()=>{});}});
    const start=Date.now();await assert.rejects(()=>p.search(input),e=>e.code==='TIMEOUT');assert.ok(Date.now()-start<500);assert.equal(signal.aborted,true);
  }
});

test('consultas simultâneas do mesmo município e segmentos compartilham uma única consulta externa',async()=>{
  let calls=0;const fetcher=async url=>{calls++;await new Promise(resolve=>setImmediate(resolve));return photonResponse(url);};
  const p=new PhotonProvider({contact:'test',fetcher});
  const [a,b]=await Promise.all([p.search(input),p.search({...input,query:'cafe'})]);
  assert.equal(calls,2);assert.equal(a.businesses.length,1);assert.equal(b.businesses.length,1);assert.equal(a.collectedAt,b.collectedAt);
});

test('falha Photon recupera por Overpass; HTTP 429 é respeitado sem troca de fonte',async()=>{
  let photon=0,overpass=0;
  const fetcher=async url=>{if(String(url).includes('photon.komoot.io')){photon++;return new Response('',{status:503});}overpass++;return Response.json({elements:[{type:'node',id:123,tags:{name:'Registro recuperado',shop:'clothes'}}]});};
  const result=await new BusinessProvider({contact:'test',fetcher}).search(input);
  assert.equal(result.businesses[0].fields.name.value,'Registro recuperado');assert.equal(photon,2);assert.equal(overpass,1);
  let count=0;const limited=new BusinessProvider({contact:'test',fetcher:async()=>{count++;return new Response('',{status:429});}});
  await assert.rejects(()=>limited.search(input),e=>e.code==='LIMIT');await assert.rejects(()=>limited.search(input),e=>e.code==='LIMIT');assert.equal(count,1);
});

test('área inválida e entrada desconhecida não geram consulta irrestrita',async()=>{
  let count=0;const p=new PhotonProvider({contact:'test',fetcher:async()=>{count++;return Response.json({features:[photonCity('São Paulo',[NaN,4,5,6])]});}});
  await assert.rejects(()=>p.search({...input,city:'Cidade inventada'}),e=>e.code==='INPUT');assert.equal(count,0);
  await assert.rejects(()=>p.search(input),e=>e.code==='AREA_UNAVAILABLE');assert.equal(count,1);
});
