import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../server/config.js';
import { publicConfig,handleAPI } from '../server/handler.js';
import { OSMProvider,buildQuery } from '../server/providers/osm.js';
import { authorizedAuditHosts } from '../server/audit.js';

test('instalação funciona sem .env e mantém credenciais de outro projeto separadas',()=>{
  const config=publicConfig({});
  assert.equal(config.search,'available');assert.equal(config.audit,'available');
  assert.equal(config.access,'supabase');assert.match(config.supabase.key,/^sb_publishable_/);
  assert.equal(config.supabase.url,'https://aotlmtaqgyxojssjxubm.supabase.co');
  assert.equal(publicConfig({ENABLE_OSM:'false'}).search,'not_configured');
  assert.equal(publicConfig({SUPABASE_URL:'https://other.supabase.co'}).supabase,null);
  assert.equal(publicConfig({DISABLE_CLOUD:'true',APP_ACCESS_KEY:'private'}).access,'access_key');
  assert.equal(resolveConfig({PROVIDER_CONTACT:''}).PROVIDER_CONTACT,'https://github.com/nicolaskirschner79-byte/Prospecta-IA');
});

test('cidade aceita acentos, variações de caixa e Distrito Federal com consulta delimitada',()=>{
  const normal=buildQuery({city:'São Paulo',uf:'sp'}),plain=buildQuery({city:'sao paulo',uf:'SP'});
  assert.equal(normal,plain);assert.ok(normal.includes('[aáàâãä]'));
  const df=buildQuery({city:'Brasília',uf:'DF'});assert.ok(df.includes('.state->.city;'));assert.ok(!df.includes('"admin_level"="8"'));
  assert.ok(buildQuery({city:'A.*[x]',uf:'SP'}).includes('\\\\.\\\\*\\\\['));
});

test('falha transitória troca de fonte uma vez; cache agrega chamadas concorrentes',async()=>{
  const calls=[];
  const fetcher=async url=>{calls.push(url);return calls.length===1?new Response('',{status:503}):Response.json({elements:[{id:99,type:'node',tags:{name:'Café de teste',amenity:'cafe'}}]});};
  const provider=new OSMProvider({contact:'test',fetcher});
  const input={city:'Itapeva',uf:'SP'};
  const [a,b]=await Promise.all([provider.search(input),provider.search(input)]);
  assert.equal(calls.length,2);assert.notEqual(calls[0],calls[1]);
  assert.equal(a.businesses.length,1);assert.equal(a.collectedAt,b.collectedAt);
  a.businesses[0].fields.name.value='Alterado pelo cliente';
  const cached=await provider.search(input);assert.equal(calls.length,2);
  assert.equal(cached.businesses[0].fields.name.value,'Café de teste');
  assert.equal(cached.businesses[0].sources[0].collectedAt,b.collectedAt);
  assert.equal(cached.businesses[0].fields.name.verifiedAt,b.collectedAt);
});

test('429 da fonte não dispara retentativa em outro servidor',async()=>{
  let count=0;
  const p=new OSMProvider({contact:'test',fetcher:async()=>{count++;return new Response('',{status:429});}});
  await assert.rejects(()=>p.search({city:'Itapeva',uf:'SP'}),e=>e.code==='LIMIT');assert.equal(count,1);
});

test('auditoria resolve domínio por operação, preservando restrições HTTPS e de host',()=>{
  assert.deepEqual(authorizedAuditHosts('https://example.com/path',{}),['example.com','www.example.com']);
  for(const url of ['https://127.0.0.1','https://localhost','https://[::1]','http://example.com','https://example.com:81','https://user:pass@example.com'])assert.throws(()=>authorizedAuditHosts(url,{}));
  assert.throws(()=>authorizedAuditHosts('https://evil.invalid',{AUDIT_ALLOWED_HOSTS:'example.com'}));
});

function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.data=JSON.parse(body);}};}
test('API completa usa configuração automática, valida usuário, reserva quota e retorna fonte real normalizada',async t=>{
  const original=globalThis.fetch,calls=[];t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'automatic-test-user'});
    if(String(url).endsWith('/rpc/consume_api_quota')){assert.equal(options.headers.Authorization,'Bearer test-token');return Response.json(true);}
    assert.match(String(url),/overpass/);return Response.json({elements:[{id:100,type:'node',tags:{name:'Loja de teste',shop:'clothes'}}]});
  };
  const res=response();
  await handleAPI({url:'/api/search',method:'POST',headers:{authorization:'Bearer test-token'},body:{city:'Itapeva',uf:'SP'}},res,{});
  assert.equal(res.statusCode,200);assert.equal(res.data.businesses[0].fields.name.value,'Loja de teste');assert.equal(calls.length,3);
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('quota indisponível impede consulta externa e rotas inválidas retornam 404',async t=>{
  const original=globalThis.fetch;let external=false;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async url=>{
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'quota-failure-test-user'});
    if(String(url).endsWith('/rpc/consume_api_quota'))return new Response('',{status:404});
    external=true;throw new Error('não deveria consultar a fonte');
  };
  const res=response();await handleAPI({url:'/api/search',method:'POST',headers:{authorization:'Bearer token'},body:{}},res,{});
  assert.equal(res.statusCode,503);assert.equal(res.data.code,'QUOTA_UNAVAILABLE');assert.equal(external,false);
  const unknown=response();await handleAPI({url:'/api/unknown',method:'POST',headers:{},body:{}},unknown,{});assert.equal(unknown.statusCode,404);
});
