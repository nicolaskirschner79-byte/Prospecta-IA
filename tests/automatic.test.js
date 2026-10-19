import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../server/config.js';
import { publicConfig,handleAPI } from '../server/handler.js';
import { OSMProvider,buildQuery } from '../server/providers/osm.js';
import { authorizedAuditHosts } from '../server/audit.js';
import { guestRateKey } from '../server/security.js';
import { photonResponse } from './fixtures-photon.js';
import {overtureTransport,overtureFeature} from './fixtures-overture.js';

test('instalação funciona sem .env e mantém credenciais de outro projeto separadas',()=>{
  const config=publicConfig({});
  assert.equal(config.search,'available');assert.equal(config.audit,'available');
  assert.equal(config.access,'supabase');assert.equal(config.searchAccess,'public');assert.match(config.supabase.key,/^sb_publishable_/);
  assert.equal(config.supabase.url,'https://aotlmtaqgyxojssjxubm.supabase.co');
  assert.equal(publicConfig({ENABLE_OSM:'false'}).search,'not_configured');
  assert.equal(publicConfig({SUPABASE_URL:'https://other.supabase.co'}).supabase,null);
  assert.equal(publicConfig({DISABLE_CLOUD:'true',APP_ACCESS_KEY:'private'}).access,'access_key');
  assert.equal(resolveConfig({PROVIDER_CONTACT:''}).PROVIDER_CONTACT,'https://github.com/nicolaskirschner79-byte/Prospecta-IA');
});

test('cidade aceita acentos, variações de caixa e Distrito Federal com consulta delimitada',()=>{
  const normal=buildQuery({city:'São Paulo',uf:'sp'}),plain=buildQuery({city:'sao paulo',uf:'SP'});
  assert.equal(normal,plain);assert.ok(normal.includes('ref:IBGE'));
  const df=buildQuery({city:'Brasília',uf:'DF'});assert.ok(df.includes('BR-DF'));assert.ok(!df.includes('"admin_level"="8"'));
  assert.throws(()=>buildQuery({city:'A.*[x]',uf:'SP'}),/Cidade não localizada/);
  assert.ok(normal.includes('3550308'));assert.ok(!normal.includes('map_to_area'));
  assert.ok(buildQuery({city:'Itapeva',uf:'SP'}).includes('3522406'));
  assert.ok(buildQuery({city:'Itapeva',uf:'MG'}).includes('3133600'));
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
test('limite público identifica conexão real e só confia no proxy da Vercel',()=>{
  const req={headers:{'x-forwarded-for':'198.51.100.1'},socket:{remoteAddress:'192.0.2.20'}};
  const local=guestRateKey(req,{});
  assert.equal(local,guestRateKey({...req,headers:{'x-forwarded-for':'198.51.100.2'}},{}));
  assert.notEqual(local,guestRateKey(req,{VERCEL:'1'}));
  assert.equal(local,guestRateKey({...req,headers:{'x-forwarded-for':'invalid'}},{VERCEL:'1'}));
  assert.ok(!local.includes('192.0.2.20'));
});

test('consulta pública de detalhes funciona sem conta e aplica intervalo entre consultas',async t=>{
  const original=globalThis.fetch;let calls=0;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async url=>{assert.ok(String(url).includes('/api/interpreter'));calls++;return Response.json({elements:[{id:501,type:'node',tags:{name:'Detalhe sem conta',shop:'clothes'}}]});};
  const req={url:'/api/details',method:'POST',headers:{},socket:{remoteAddress:'192.0.2.21'},body:{id:'osm-node-501'}};
  const first=response();await handleAPI(req,first,{});
  assert.equal(first.statusCode,200);assert.equal(first.data.business.fields.name.value,'Detalhe sem conta');
  const second=response();await handleAPI(req,second,{});assert.equal(second.statusCode,429);assert.equal(calls,1);
});

test('API pública busca sem conta nem consulta ao banco, mesmo com token inválido',async t=>{
  const original=globalThis.fetch,calls=[];t.after(()=>{globalThis.fetch=original;});
  const transport=overtureTransport([overtureFeature({'@name':'Loja de teste',names:JSON.stringify({primary:'Loja de teste'})})]);
  globalThis.fetch=async(url,options)=>{calls.push(String(url));return transport(url,options);};
  const res=response();
  await handleAPI({url:'/api/search',method:'POST',headers:{authorization:'Bearer expired-token'},socket:{remoteAddress:'192.0.2.1'},body:{city:'Itapeva',uf:'SP'}},res,{});
  assert.equal(res.statusCode,200);assert.equal(res.data.businesses[0].fields.name.value,'Loja de teste');assert.ok(calls.length>=2);assert.ok(calls.every(url=>['photon.komoot.io','tiles.overturemaps.org'].includes(new URL(url).hostname)));assert.equal(res.data.businesses[0].fields.phone.value,'+551500000000');
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('quota indisponível impede consulta externa e rotas inválidas retornam 404',async t=>{
  const original=globalThis.fetch;let external=false;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async url=>{
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'quota-failure-test-user'});
    if(String(url).endsWith('/rpc/consume_api_quota'))return new Response('',{status:404});
    external=true;throw new Error('não deveria consultar a fonte');
  };
  const res=response();await handleAPI({url:'/api/audit',method:'POST',headers:{authorization:'Bearer token'},body:{}},res,{});
  assert.equal(res.statusCode,503);assert.equal(res.data.code,'QUOTA_UNAVAILABLE');assert.equal(external,false);
  const unknown=response();await handleAPI({url:'/api/unknown',method:'POST',headers:{},body:{}},unknown,{});assert.equal(unknown.statusCode,404);
});
