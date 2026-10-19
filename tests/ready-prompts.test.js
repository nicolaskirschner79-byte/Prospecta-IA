import test from 'node:test';
import assert from 'node:assert/strict';
import {newBusiness,field,DEFAULT_SETTINGS,SEGMENTS} from '../public/lib/domain.js';
import {generateBriefing} from '../public/lib/briefing.js';
import {ensureReadyPrompt,prepareBusinesses} from '../public/lib/automatic.js';
import {promptAllowed} from '../public/lib/permissions.js';
const base=()=>newBusiness({name:'Restaurante Exemplo',city:'Itapeva',uf:'SP',segment:'food',district:'Centro',address:'Rua de Teste, 123',services:'Serviço confirmado de teste'});

test('todos os segmentos recebem prompt completo e direções diferentes usando os dados específicos do comércio',()=>{
  const texts=[];
  for(const segment of Object.keys(SEGMENTS)){
    const b=base();b.segment=segment;const text=generateBriefing(b,DEFAULT_SETTINGS);texts.push(text);
    assert.equal((text.match(/^\d+\. /gm)||[]).length,14);assert.ok(text.length>10000);assert.match(text,/Restaurante Exemplo/);assert.match(text,/Rua de Teste, 123/);assert.match(text,/Serviço confirmado de teste/);
    for(const requirement of ['DIREÇÃO DE DESIGN','ARQUITETURA','FUNCIONALIDADES','RESPONSIVIDADE','CRITÉRIOS DE ACEITAÇÃO','README','nenhuma informação inventada'])assert.ok(text.toUpperCase().includes(requirement.toUpperCase()),requirement);
  }
  assert.equal(new Set(texts).size,Object.keys(SEGMENTS).length);
  assert.match(texts[Object.keys(SEGMENTS).indexOf('vehicles')],/Ficha individual de cada veículo/);
  assert.match(texts[Object.keys(SEGMENTS).indexOf('food')],/Cardápio por categoria/);
  assert.match(texts[Object.keys(SEGMENTS).indexOf('accounting')],/Serviços contábeis confirmados/);
});

test('prompt automático já nasce pronto, é idempotente e não cria versões duplicadas ao renderizar',()=>{
  const b=base(),p=ensureReadyPrompt(b,DEFAULT_SETTINGS);assert.equal(p.automatic,true);assert.equal(p.destination,'ai');assert.equal(promptAllowed(b,p,'ai'),true);
  for(let i=0;i<10;i++)assert.equal(ensureReadyPrompt(b,DEFAULT_SETTINGS),p);
  assert.equal(b.prompts.length,1);assert.match(p.text,/Restaurante Exemplo/);
});

test('atualizar o comércio refaz somente a versão automática, preservando as edições manuais',()=>{
  const b=base(),first=ensureReadyPrompt(b,DEFAULT_SETTINGS);b.prompts.push({...first,id:'manual',automatic:false,text:'Edição manual que deve permanecer'});
  b.fields.name.value='Novo Nome';b.segment='beauty';const next=ensureReadyPrompt(b,DEFAULT_SETTINGS);
  assert.notEqual(next.id,first.id);assert.match(next.text,/Novo Nome/);assert.match(next.text,/Galeria de trabalhos autorizados/);
  assert.equal(b.prompts.filter(p=>p.automatic).length,1);assert.ok(b.prompts.some(p=>p.text==='Edição manual que deve permanecer'));
});

test('versão pronta para IA remove campos proibidos e se atualiza quando a permissão muda',()=>{
  const b=base(),source=b.sources[0].id;b.fields.description=field('CONTEUDO_QUE_SERA_RESTRITO',source);
  const first=ensureReadyPrompt(b,DEFAULT_SETTINGS);assert.match(first.text,/CONTEUDO_QUE_SERA_RESTRITO/);
  b.fields.description.permissions={retain:true,export:true,ai:false};const current=ensureReadyPrompt(b,DEFAULT_SETTINGS);
  assert.notEqual(first.id,current.id);assert.ok(!current.text.includes('CONTEUDO_QUE_SERA_RESTRITO'));assert.equal(b.prompts.length,1);
  b.sources[0].permissions.ai=false;const internal=ensureReadyPrompt(b,DEFAULT_SETTINGS);assert.equal(internal.destination,'internal');assert.equal(promptAllowed(b,internal,'ai'),false);
  b.sources[0].permissions.export=false;assert.equal(ensureReadyPrompt(b,DEFAULT_SETTINGS),null);
});

test('data de validade do prompt respeita o campo mais restrito e nenhum contato é inventado',()=>{
  const b=base(),expiry=new Date(Date.now()+86400000).toISOString();b.fields.address.expiresAt=expiry;
  const ready=ensureReadyPrompt(b,DEFAULT_SETTINGS);assert.equal(ready.expiresAt,expiry);
  assert.match(ready.text,/WhatsApp: \[CONFIRMAR COM A EMPRESA\]/);assert.match(ready.text,/paleta como oficial/);
  b.sources[0].expiresAt='2000-01-01';assert.equal(ensureReadyPrompt(b,DEFAULT_SETTINGS),null);
});

test('lote de busca prepara cada comércio sem chamada externa e sem misturar informações',()=>{
  const businesses=Array.from({length:50},(_,i)=>newBusiness({name:`Comércio Teste ${i}`,segment:i%2?'beauty':'food',city:'Itapeva',uf:'SP'}));
  assert.equal(prepareBusinesses(businesses,DEFAULT_SETTINGS),businesses);
  for(const [index,b]of businesses.entries()){assert.equal(b.prompts.length,1);assert.ok(b.prompts[0].text.includes(`Comércio Teste ${index}`));assert.ok(JSON.stringify(b).length<500000);}
});
