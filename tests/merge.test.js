import test from 'node:test';
import assert from 'node:assert/strict';
import {newBusiness,field} from '../public/lib/domain.js';
import {sameBusiness,mergePublished,needsContactRefresh} from '../public/lib/merge.js';
test('atualização preenche campos ausentes da mesma unidade e preserva confirmação e notas manuais',()=>{
  const a=newBusiness({name:'Loja de Teste',city:'Itapeva',uf:'SP',address:'Rua de Teste, 1',phone:'+551500000001'}),b=newBusiness({name:'Loja de Teste',city:'Itapeva',uf:'SP',address:'Rua de Teste, 1',phone:'+551500000002',email:'mail@example.invalid'});
  a.fields.phone.confirmed=true;a.notes='Nota do usuário';const result=mergePublished(a,b);assert.equal(result.changed,true);
  assert.equal(result.business.fields.phone.value,'+551500000001');assert.equal(result.business.fields.email.value,'mail@example.invalid');assert.equal(result.business.notes,'Nota do usuário');assert.equal(a.fields.email.value,'');
});
test('homônimos e unidades diferentes não compartilham contatos por nome e cidade',()=>{
  const a=newBusiness({name:'Loja de Teste',city:'Itapeva',uf:'SP',address:'Rua A, 1'}),b=newBusiness({name:'Loja de Teste',city:'Itapeva',uf:'SP',address:'Rua B, 9'});
  assert.equal(sameBusiness(a,b),false);assert.equal(mergePublished(a,b),null);a.location={lon:-48.8,lat:-23.9};b.location={lon:-48.8,lat:-23.9002};assert.equal(sameBusiness(a,b),true);
});
test('atualização automática alcança somente amostra antiga sem contatos da cidade selecionada',()=>{
  const b=newBusiness({name:'Loja de Teste',city:'Itapeva',uf:'SP'});b.providerId='osm-node-1';
  assert.equal(needsContactRefresh([b],{city:'Itapeva',uf:'SP'}),true);assert.equal(needsContactRefresh([b],{city:'Sorocaba',uf:'SP'}),false);
  b.fields.phone=field('+551500000000',b.sources[0].id);assert.equal(needsContactRefresh([b],{city:'Itapeva',uf:'SP'}),false);
});
