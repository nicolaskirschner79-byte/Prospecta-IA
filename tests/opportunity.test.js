import test from 'node:test';
import assert from 'node:assert/strict';
import {newBusiness,field,DEFAULT_SETTINGS,validateSettings} from '../public/lib/domain.js';
import {evaluateOpportunity} from '../public/lib/opportunity.js';
import {calculateScore} from '../public/lib/score.js';
const base=()=>newBusiness({name:'Salão Exemplo',city:'Itapeva',uf:'SP',segment:'beauty'});
const assess=(b,key,value,extra={})=>b.assessments[key]={...field('',b.sources[0].id),value,status:'user',reason:'Informação confirmada diretamente para o teste.',...extra};

test('cadastro só com nome e cidade não recebe uma nota artificial',()=>{
  const b=base(),before=structuredClone(b.assessments),result=evaluateOpportunity(b);
  assert.equal(result.score,null);assert.equal(result.eligible,false);assert.equal(result.preliminary,true);assert.equal(result.confidence,'low');
  assert.equal(result.coverage,0);assert.equal(result.probability,null);assert.match(result.offer,/horário/);assert.match(result.explanation,/Dados insuficientes/);
  assert.equal(result.parts.find(p=>p.id==='interest').points,0);assert.deepEqual(b.assessments,before);assert.equal(calculateScore(b).score,0,'evidências manuais não são fabricadas pela avaliação automática');
});

test('ausência na fonte não equivale a ausência confirmada; domínio existente não é julgado ruim',()=>{
  const b=base();b.fields.address=field('Rua de Teste, 1',b.sources[0].id);b.fields.phone=field('+551500000000',b.sources[0].id);const unknown=evaluateOpportunity(b);b.fields.website=field('https://example.com',b.sources[0].id);
  const site=evaluateOpportunity(b);assert.ok(site.score<unknown.score);assert.match(site.parts[0].reason,/não foram verificadas/);
  assess(b,'digital','absent',{sufficient:true});const confirmed=evaluateOpportunity(b);assert.ok(confirmed.score>unknown.score);assert.equal(confirmed.parts[0].mode,'evidence');
});

test('contatos publicados melhoram a investigação; confirmação melhora a nota sem transformar telefone em WhatsApp',()=>{
  const b=base();b.fields.address=field('Rua de Teste, 1',b.sources[0].id);const missing=evaluateOpportunity(b);b.fields.phone=field('+551500000000',b.sources[0].id);
  const published=evaluateOpportunity(b);assert.ok(published.score>missing.score);assert.match(published.parts.find(p=>p.id==='contact').reason,/confirmar titularidade/);
  b.fields.whatsapp=field('+551500000000',b.sources[0].id,{confirmed:true});const confirmed=evaluateOpportunity(b);assert.ok(confirmed.score>published.score);
  b.fields.whatsapp.status='conflict';assert.ok(evaluateOpportunity(b).score<confirmed.score);
});

test('conflito de identidade, registro suprimido, negociação encerrada e fonte vencida não entram na prioridade ativa',()=>{
  const b=base();b.fields.name.status='conflict';assert.equal(evaluateOpportunity(b).eligible,false);b.fields.name.status='user';
  assess(b,'identity',false);assert.equal(evaluateOpportunity(b).priority,'pending');delete b.assessments.identity;
  for(const stage of ['Não contatar','Fechado','Perdido']){b.stage=stage;assert.equal(evaluateOpportunity(b).priority,'excluded');assert.equal(evaluateOpportunity(b).score,0);}
  b.stage='Novo';b.sources[0].expiresAt='2000-01-01';assert.equal(evaluateOpportunity(b).eligible,false);
});

test('verificações negativas prevalecem sobre hipóteses e fonte restrita não aumenta pontos',()=>{
  const b=base();for(const key of ['useCase','informationNeed','benefit'])assess(b,key,false);
  assert.equal(evaluateOpportunity(b).parts.find(p=>p.id==='fit').points,0);
  b.sources.push({id:'expired',expiresAt:'2000-01-01',permissions:{retain:true}});
  b.fields.phone=field('+551500000000','expired',{confirmed:true});assert.equal(evaluateOpportunity(b).parts.find(p=>p.id==='contact').points,0);
  assess(b,'interest',false);assert.match(evaluateOpportunity(b).nextAction,/Respeitar a resposta/);assert.equal(evaluateOpportunity(b).priority,'excluded');
});

test('evidências suficientes e interesse real aumentam confiança; configurações mantêm pesos e limites',()=>{
  const b=base();for(const key of ['identity','recentActivity','consistentInfo','useCase','informationNeed','benefit','interest','nextStep'])assess(b,key,true);
  assess(b,'digital','absent',{sufficient:true});assess(b,'contactChecked',true);
  const result=evaluateOpportunity(b);assert.equal(result.confidence,'high');assert.equal(result.preliminary,false);assert.equal(result.priority,'high');assert.equal(result.coverage,100);assert.ok(result.score<=100);
  const custom=validateSettings({...DEFAULT_SETTINGS,weights:{digital:10,operation:10,fit:10,contact:60,interest:10}});
  assert.ok(evaluateOpportunity(b,custom).score<result.score,'não há canal confirmado para receber pontos de contato');
});

test('escolas e unidades públicas identificadas pelo nome não são priorizadas como comércios privados',()=>{
  for(const [name,segment]of [['Escola Estadual Exemplo','education'],['Escola Municipal Exemplo','education'],['UBS Vila de Teste','health']]){
    const b=newBusiness({name,segment,city:'Itapeva',uf:'SP'}),result=evaluateOpportunity(b);
    assert.equal(result.priority,'excluded');assert.equal(result.score,0);assert.match(result.nextAction,/nome do cadastro indica/);
  }
  for(const [name,segment]of [['Escola Particular de Teste','education'],['Clínica Exemplo','health'],['UBS Consultoria de Teste','other']])assert.notEqual(evaluateOpportunity(newBusiness({name,segment})).priority,'excluded');
});
