import test from 'node:test';
import assert from 'node:assert/strict';
import { OSMProvider,buildQuery } from '../server/providers/osm.js';
import { handleAPI } from '../server/handler.js';
import { searchBusinesses,searchKey } from '../public/lib/search.js';

const input={city:'Itapeva',uf:'SP',segments:[]};
const source=()=>({elements:[{id:731,type:'node',tags:{name:'Comércio de teste',shop:'clothes'}}]});
const browserData=()=>({businesses:[{id:'fixture'}],collectedAt:new Date().toISOString(),notice:'Consulta de teste',cache:'miss'});

test('consulta municipal usa código oficial e filtros canônicos, sem varrer municípios da UF',()=>{
  const q=buildQuery(input);assert.ok(q.includes('["IBGE:GEOCODIGO"="3522406"]'));
  assert.ok(!q.includes('map_to_area'));assert.ok(!q.includes('["name"~'));
  assert.equal(buildQuery({...input,segments:['food','beauty','food']}),buildQuery({...input,segments:['beauty','food']}));
  assert.throws(()=>buildQuery({...input,city:'Cidade inexistente de teste'}),/Cidade não localizada/);
  for(const segments of [null,{},['__proto__'],['constructor']])assert.throws(()=>buildQuery({...input,segments}),/Segmento inválido/);
});

test('fontes que ignoram AbortSignal também têm prazo total; cooldown evita repetir a espera',async()=>{
  const signals=[];const fetcher=async(_url,options)=>{signals.push(options.signal);return new Promise(()=>{});};
  const p=new OSMProvider({contact:'test',fetcher,requestTimeoutMs:8}),start=Date.now();
  await assert.rejects(()=>p.search(input),e=>e.code==='TIMEOUT');
  assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));assert.ok(Date.now()-start<500);
  await assert.rejects(()=>p.search(input),e=>e.code==='UNAVAILABLE');assert.equal(signals.length,2);
});

test('leitura de corpo travada não impede recuperar resultado na outra fonte',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return calls===1?new Response(new ReadableStream({start(){}})):Response.json(source());};
  const p=new OSMProvider({contact:'test',fetcher,requestTimeoutMs:8});
  const result=await p.search(input);assert.equal(result.businesses.length,1);assert.equal(calls,2);
  await p.search({...input,segments:['fashion']});assert.equal(calls,3,'a fonte saudável passa a ser usada primeiro');
});

test('timeout informado em JSON vazio é falha recuperável, não resultado vazio bem-sucedido',async()=>{
  let calls=0;
  const p=new OSMProvider({contact:'test',fetcher:async()=>{calls++;return Response.json(calls===1?{remark:'runtime error: Query timed out',elements:[]}:source());}});
  const result=await p.search(input);assert.equal(result.businesses.length,1);assert.equal(calls,2);
});

test('resposta parcial com dados reais é preservada sem segunda consulta desnecessária',async()=>{
  let calls=0;
  const p=new OSMProvider({contact:'test',fetcher:async()=>{calls++;return Response.json({...source(),remark:'runtime limit'});}});
  const result=await p.search(input);assert.equal(result.state,'partial');assert.equal(result.businesses.length,1);assert.equal(calls,1);
});

test('contingência usa somente consulta anterior com data original e validade limitada',async()=>{
  let now=Date.now(),offline=false,calls=0;
  const p=new OSMProvider({contact:'test',now:()=>now,fetcher:async()=>{calls++;return offline?new Response('',{status:503}):Response.json(source());}});
  const first=await p.search(input);now+=600001;offline=true;
  const stale=await p.search(input);assert.equal(stale.cache,'stale');assert.equal(stale.state,'partial');assert.equal(stale.collectedAt,first.collectedAt);
  assert.match(stale.notice,/consulta salva/);assert.equal(stale.businesses[0].fields.name.verifiedAt,first.collectedAt);
  await p.search(input);assert.equal(calls,3,'cooldown atende com cache sem repetir servidores indisponíveis');
  now+=12*3600000;await assert.rejects(()=>p.search(input),e=>e.code==='UNAVAILABLE');
});

test('repetir busca no navegador usa cache sem nova chamada e sem compartilhar objetos editáveis',async()=>{
  let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.ok(url.startsWith('/api/search?'));assert.equal(options.method,'GET');assert.equal(options.headers?.Authorization,undefined);return Response.json(browserData());};
  const a=await searchBusinesses(input,{fetcher});a.businesses[0].id='edição local';
  const b=await searchBusinesses({...input,city:' ITAPEVA ',uf:'sp'},{fetcher});
  assert.equal(calls,1);assert.equal(b.browserCache,true);assert.equal(b.businesses[0].id,'fixture');
  assert.equal(searchKey({...input,segments:['food','beauty']}),searchKey({...input,segments:['beauty','food','food']}));
});

test('prazo do navegador encerra chamada travada sem depender do transporte',async()=>{
  const start=Date.now();
  await assert.rejects(()=>searchBusinesses(input,{timeoutMs:8,fetcher:async()=>new Promise(()=>{})}),/não respondeu/);
  assert.ok(Date.now()-start<500);
});

test('cancelamento é imediato e não converte uma resposta tardia em resultado',async()=>{
  const controller=new AbortController();let upstreamSignal;
  const pending=searchBusinesses(input,{signal:controller.signal,fetcher:async(_url,options)=>{upstreamSignal=options.signal;return new Promise(()=>{});}});
  controller.abort();await assert.rejects(()=>pending,e=>e.name==='AbortError');assert.equal(upstreamSignal.aborted,true);
});

test('navegador preserva consulta anterior em falha temporária, mas não em erro de entrada ou cache vencido',async()=>{
  let now=Date.now(),status=200;
  const fetcher=async()=>status===200?Response.json(browserData()):Response.json({message:'Falha de teste'},{status});
  await searchBusinesses(input,{fetcher,now:()=>now});now+=600001;status=503;
  const stale=await searchBusinesses(input,{fetcher,now:()=>now});assert.equal(stale.cache,'stale');assert.match(stale.notice,/última busca salva/);
  status=400;await assert.rejects(()=>searchBusinesses(input,{fetcher,now:()=>now}),/Falha de teste/);
  status=503;now+=12*3600000;await assert.rejects(()=>searchBusinesses(input,{fetcher,now:()=>now}),/Falha de teste/);
});

const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.data=JSON.parse(text);}});
test('GET compartilha apenas resultados públicos bem-sucedidos; erros continuam sem cache',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async()=>Response.json(source());
  const res=response();await handleAPI({url:'/api/search?city=Itapeva&uf=SP',method:'GET',headers:{},socket:{remoteAddress:'192.0.2.31'}},res,{});
  assert.equal(res.statusCode,200);assert.match(res.headers['Vercel-CDN-Cache-Control'],/max-age=600/);assert.match(res.headers['Cache-Control'],/public/);
  const invalid=response();await handleAPI({url:'/api/search?city=Inv%C3%A1lida&uf=SP',method:'GET',headers:{},socket:{remoteAddress:'192.0.2.32'}},invalid,{});
  assert.equal(invalid.statusCode,400);assert.equal(invalid.headers['Cache-Control'],'no-store');assert.equal(invalid.headers['Vercel-CDN-Cache-Control'],undefined);
  const protectedRoute=response();await handleAPI({url:'/api/audit',method:'GET',headers:{}},protectedRoute,{});assert.equal(protectedRoute.statusCode,405);
});
