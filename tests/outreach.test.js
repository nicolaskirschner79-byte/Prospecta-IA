import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {newBusiness,DEFAULT_SETTINGS,SEGMENTS,whatsappURL,field} from '../public/lib/domain.js';
import {approach,whatsappDraft} from '../public/lib/outreach.js';
import {card} from '../public/lib/ui.js';
const business=(extra={})=>newBusiness({name:'Comércio de teste',city:'Itapeva',uf:'SP',phone:'+551500000000',segment:'beauty',...extra});

test('telefone publicado abre rascunho no destino exato sem afirmar que é WhatsApp confirmado',()=>{
  const b=business(),before=structuredClone(b),draft=whatsappDraft(b),url=new URL(draft.url);
  assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/551500000000');assert.equal(url.searchParams.get('text'),approach(b));
  assert.equal(draft.requiresCheck,true);assert.equal(draft.confirmed,false);assert.equal(whatsappURL(b),null);assert.deepEqual(b,before);
});
test('WhatsApp explícito tem prioridade sobre telefone e preserva confirmação ou publicação',()=>{
  const b=business({whatsapp:'https://wa.me/551500000001?text=texto-antigo'});b.fields.whatsapp.published=true;
  let draft=whatsappDraft(b);assert.equal(new URL(draft.url).pathname,'/551500000001');assert.equal(draft.requiresCheck,false);assert.equal(draft.published,true);assert.equal(draft.confirmed,false);
  b.fields.whatsapp.confirmed=true;assert.equal(whatsappDraft(b).confirmed,true);
  b.fields.whatsapp.value='https://api.whatsapp.com/send?phone=551500000002';draft=whatsappDraft(b);assert.equal(new URL(draft.url).pathname,'/551500000002');
});
test('mensagem varia por segmento, unidade, serviços e presença digital sem inventar inspeção',()=>{
  const texts=Object.keys(SEGMENTS).map(segment=>approach(business({segment})));assert.equal(new Set(texts).size,Object.keys(SEGMENTS).length);
  const b=business({name:'Móveis & Decoração Teste',segment:'furniture',services:'Móveis planejados',website:'https://example.invalid/'});
  const text=approach(b,{...DEFAULT_SETTINGS,seller:'Vendedor Teste',agency:'Agência Teste'});
  for(const value of ['Móveis & Decoração Teste','Itapeva','móveis, materiais e projetos','Móveis planejados','Agência Teste','Vendedor Teste','Se vocês já utilizam um site'])assert.ok(text.includes(value),value);
  assert.doesNotMatch(text,/site ruim|aumentar suas vendas|analisei|sem site|não têm site/i);
  b.fields.website.value='';b.fields.social={...field('https://instagram.com/test-fixture',b.sources[0].id)};assert.match(approach(b),/complemente as redes sociais/);
});
test('edição com acentos, quebras e símbolos é codificada integralmente, sem mudar etapa',()=>{
  const b=business(),message='Olá!\nProposta & dúvidas: 50%? “Teste” #1';
  assert.equal(new URL(whatsappDraft(b,DEFAULT_SETTINGS,{message}).url).searchParams.get('text'),message);assert.equal(b.stage,'Novo');
});
test('sem dígitos completos, sem permissão, fonte vencida, conflito e demonstração não geram botão acionável',()=>{
  for(const phone of ['','(15) 99999-9999','+5535211617','https://evil.invalid/551500000000','javascript:alert(1)'])assert.equal(whatsappDraft(business({phone})),null);
  for(const mutate of [b=>b.demo=true,b=>b.sources[0].permissions.export=false,b=>b.fields.phone.permissions={retain:true,export:false},b=>b.fields.name.status='conflict',b=>b.fields.phone.status='conflict',b=>b.fields.phone.expiresAt='2000-01-01',b=>b.sources[0].expiresAt='2000-01-01']){const b=business();mutate(b);assert.equal(whatsappDraft(b),null);}
});
test('não contatar e unidades encerradas ou duplicadas não oferecem abordagem',()=>{
  const b=business();b.stage='Não contatar';assert.equal(whatsappDraft(b),null);b.stage='Novo';
  for(const lifecycle of ['closed','duplicate','out_of_scope']){b.lifecycle=lifecycle;assert.equal(whatsappDraft(b),null);}
});
test('rascunho não exporta dados restritos e botão do cartão traz a abordagem da própria unidade',()=>{
  const b=business();b.sources.push({id:'restricted',permissions:{retain:true,export:false}});b.fields.services=field('SERVIÇO_RESTRITO','restricted');assert.ok(!approach(b).includes('SERVIÇO_RESTRITO'));
  const {document}=parseHTML(card(b,DEFAULT_SETTINGS)),button=document.querySelector('a[data-whatsapp-draft]');
  assert.ok(button);assert.equal(new URL(button.getAttribute('href')).searchParams.get('text'),approach(b));assert.match(button.textContent,/a confirmar/);
  b.demo=true;assert.equal(parseHTML(card(b,DEFAULT_SETTINGS)).document.querySelector('[data-whatsapp-draft]'),null);
});
