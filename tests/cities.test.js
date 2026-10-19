import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {STATES} from '../public/lib/regions.js';
import {loadCities,createCityPicker} from '../public/lib/cities.js';
import {MUNICIPALITIES} from '../server/data/municipalities.js';
import {normalizeText} from '../public/lib/domain.js';

const catalog=async uf=>JSON.parse(await readFile(new URL(`../public/data/cities/${uf}.json`,import.meta.url),'utf8'));
test('catálogo local contém todos os municípios oficiais e preserva os nomes acentuados',async()=>{
  let total=0;const ids=new Set();
  for(const uf of Object.keys(STATES)){
    const cities=await catalog(uf);total+=cities.length;
    for(const city of cities){assert.equal(ids.has(city.id),false);ids.add(city.id);assert.equal(MUNICIPALITIES[uf][normalizeText(city.name).replace(/\s+/g,' ')],city.id);}
  }
  assert.equal(Object.keys(STATES).length,27);assert.equal(total,5571);
  assert.ok((await catalog('SP')).some(c=>c.name==='São Paulo'));
  assert.deepEqual((await catalog('DF')).map(c=>c.name),['Brasília']);
});

test('catálogo usa somente arquivos do site, agrega chamadas e permite tentar novamente após falha',async()=>{
  let calls=0,fail=true;
  const fetcher=async url=>{calls++;assert.equal(url,'/data/cities/SP.json');return fail?new Response('',{status:503}):Response.json([{id:3550308,name:'São Paulo'}]);};
  await assert.rejects(()=>loadCities('SP',{fetcher}),/carregar/);fail=false;
  const [a,b]=await Promise.all([loadCities('SP',{fetcher}),loadCities('SP',{fetcher})]);
  assert.equal(calls,2);assert.equal(a,b);await assert.rejects(()=>loadCities('../x',{fetcher}),/estado válido/);
});

async function pickerDOM(t,fetcher){
  const original={document:globalThis.document,fetch:globalThis.fetch};t.after(()=>Object.assign(globalThis,original));
  const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  Object.assign(globalThis,{document,fetch:fetcher|| (async url=>Response.json(await catalog(url.match(/([A-Z]{2})\.json$/)[1])))});
  const root=document.querySelector('#city-picker'),input=root.querySelector('input');
  return {window,root,input,picker:createCityPicker(root)};
}

test('troca de UF limpa a cidade e o catálogo; pesquisa ignora acentos e teclado escolhe nome oficial',async t=>{
  const {window,root,input,picker}=await pickerDOM(t);
  await picker.setState('SP','Itapeva');assert.equal(input.value,'Itapeva');assert.equal(picker.validate(),true);
  input.value='sao paulo';input.dispatchEvent(new window.Event('input'));
  assert.ok([...root.querySelectorAll('[role=option]')].some(e=>e.textContent==='São Paulo'));
  const down=new window.Event('keydown',{cancelable:true});Object.defineProperty(down,'key',{value:'ArrowDown'});input.dispatchEvent(down);
  const enter=new window.Event('keydown',{cancelable:true});Object.defineProperty(enter,'key',{value:'Enter'});input.dispatchEvent(enter);
  assert.equal(input.value,'São Paulo');assert.equal(picker.validate(),true);
  await picker.setState('MG');assert.equal(input.value,'');assert.equal(picker.state,'MG');
  input.value='São Paulo';assert.equal(picker.validate(),false);assert.equal(input.getAttribute('aria-invalid'),'true');
  input.value='belo horizonte';assert.equal(picker.validate(),true);assert.equal(input.value,'Belo Horizonte');
});

test('resposta atrasada de outro estado não substitui o catálogo atual',async t=>{
  const pending={};const {picker,input}=await pickerDOM(t,url=>new Promise(resolve=>{pending[url.match(/([A-Z]{2})\.json$/)[1]]=resolve;}));
  const old=picker.setState('SP','São Paulo'),current=picker.setState('MG','Belo Horizonte');
  pending.MG(Response.json(await catalog('MG')));await current;assert.equal(input.value,'Belo Horizonte');
  pending.SP(Response.json(await catalog('SP')));await old;assert.equal(input.value,'Belo Horizonte');assert.equal(picker.state,'MG');
});
