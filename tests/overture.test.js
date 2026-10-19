import test from 'node:test';
import assert from 'node:assert/strict';
import {OvertureProvider,normalizeOverture,readOvertureTile,tileFor} from '../server/providers/overture.js';
import {contactLinks,phoneNumber,emailAddress,websiteKind} from '../public/lib/contacts.js';
import {evaluateOpportunity} from '../public/lib/opportunity.js';
import {overtureFeature,overtureTransport} from './fixtures-overture.js';
const input={city:'Itapeva',uf:'SP',segments:[]};

test('recortes binários PMTiles são decodificados de ponta a ponta com telefone e e-mail do mesmo registro',async()=>{
  const urls=[],transport=overtureTransport(),fetcher=async(url,options)=>{urls.push(String(url));return transport(url,options);};
  const result=await new OvertureProvider({contact:'test',fetcher}).search(input);
  assert.equal(result.provider,'overture');assert.equal(result.businesses.length,1);const b=result.businesses[0];
  assert.equal(b.fields.phone.value,'+551500000000');assert.equal(b.fields.email.value,'contato@example.invalid');assert.equal(b.fields.whatsapp.value,'');
  assert.ok(b.sources[0].license.includes('CDLA-Permissive-2.0'));assert.ok(contactLinks(b).some(c=>c.href==='tel:+551500000000'));
  assert.ok(urls.every(url=>['photon.komoot.io','tiles.overturemaps.org'].includes(new URL(url).hostname)));
});

test('normalização exige mesma cidade, UF, país, licença permitida e confiança mínima da origem',()=>{
  const at=new Date().toISOString();assert.ok(normalizeOverture(overtureFeature(),input,at));
  for(const props of [
    {addresses:JSON.stringify([{country:'BR',region:'MG',locality:'Itapeva'}])},
    {addresses:JSON.stringify([{country:'BR',region:'SP',locality:'Sorocaba'}])},
    {addresses:JSON.stringify([{country:'PT',region:'SP',locality:'Itapeva'}])},
    {sources:JSON.stringify([{license:'unknown'}])},{confidence:.1},{id:'not-an-id'}
  ])assert.equal(normalizeOverture(overtureFeature(props),input,at),null);
});

test('domínios próprios, páginas e WhatsApp explícito são identificados sem converter telefone em WhatsApp',()=>{
  const feature=overtureFeature({websites:JSON.stringify(['https://www.instagram.com/test-fixture','https://example.invalid/']),socials:JSON.stringify(['https://wa.me/551500000000'])});
  const b=normalizeOverture(feature,input,new Date().toISOString());assert.equal(b.fields.website.value,'https://example.invalid/');
  assert.equal(b.fields.whatsapp.published,true);assert.ok(contactLinks(b).some(c=>c.kind==='whatsapp'));
  assert.equal(websiteKind('https://instagram.com/loja'),'platform');assert.equal(websiteKind('https://example.invalid'),'website');
  assert.equal(phoneNumber('55 15 0000-0000'),'+551500000000');assert.equal(phoneNumber('123'),null);assert.equal(emailAddress('mail@example.invalid\nBcc:x'),null);
});

test('dados individuais e segmento produzem avaliações diferentes sem criar variação pelo nome',()=>{
  const at=new Date().toISOString(),features=[
    overtureFeature({taxonomy:JSON.stringify({primary:'auto_dealer'}),basic_category:'auto_dealer'}),
    overtureFeature({taxonomy:JSON.stringify({primary:'grocery_store'}),basic_category:'grocery_store',emails:'[]',websites:JSON.stringify(['https://example.invalid/'])}),
    overtureFeature({taxonomy:JSON.stringify({primary:'hair_salon'}),basic_category:'personal_or_beauty_service',emails:'[]'})
  ];
  const scores=features.map(f=>evaluateOpportunity(normalizeOverture(f,input,at)).score);assert.equal(new Set(scores).size,3);
  const b=normalizeOverture(features[0],input,at),before=evaluateOpportunity(b).score;b.fields.name.value='Outro nome com os mesmos dados';assert.equal(evaluateOpportunity(b).score,before);
});

test('catálogo que ignora range ou trava tem prazo e não tenta baixar o arquivo global',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
  await assert.rejects(()=>readOvertureTile(tileFor(-48.88,-23.98),{contact:'test',fetcher:async()=>response}),e=>e.code==='UNAVAILABLE');assert.equal(cancelled,true);
  const start=Date.now(),p=new OvertureProvider({contact:'test',timeoutMs:10,fetcher:async()=>new Promise(()=>{})});
  await assert.rejects(()=>p.search(input),e=>e.code==='TIMEOUT');assert.ok(Date.now()-start<500);
});

test('cache de recorte permite repetir pesquisa sem novas chamadas externas',async()=>{
  let calls=0;const transport=overtureTransport(),p=new OvertureProvider({contact:'test',fetcher:async(...args)=>{calls++;return transport(...args);}});
  const first=await p.search(input),before=calls,second=await p.search(input);assert.equal(calls,before);assert.equal(second.collectedAt,first.collectedAt);
});
