import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {handleAPI,publicConfig} from '../server/handler.js';
test('fluxo DOM: demonstração, filtro, ficha, briefing, versão, favorito e volta preservando filtro',async()=>{
  const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(v));}});
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',Boolean(v));}});
  for(const d of document.querySelectorAll('dialog')){d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;d.dispatchEvent(new window.Event('close'));};}
  const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const location={hash:'',pathname:'/',search:''};const history={pushState(_a,_b,url){location.hash=url;},replaceState(_a,_b,url){location.hash=url.startsWith('#')?url:'';}};
  class FormDataDOM extends Map{constructor(form){super();for(const el of form.querySelectorAll('[name]')){if(el.type==='checkbox'&&!el.checked)continue;this.set(el.getAttribute('name'),el.value??'');}}}
  Object.assign(globalThis,{window,document,location,history,localStorage:storage,FormData:FormDataDOM});
  window.innerWidth=1440;globalThis.fetch=async()=>Response.json({search:'not_configured',audit:'not_configured',access:'not_configured',supabase:null});
  const $=s=>document.querySelector(s),click=s=>$(s).dispatchEvent(new window.Event('click',{bubbles:true}));
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await import('../public/app.js');
  assert.match($('#results').textContent,/Toda boa conversa/);
  click('[data-action="toggle-demo"]');assert.equal(document.querySelectorAll('.business-card').length,6);assert.equal($('#mode-banner').hidden,false);
  $('#local-query').value='Aurora';$('#local-query').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.business-card').length,1);
  click('[data-action="prompt"][data-id="demo-1"]');assert.equal($('#detail-dialog').open,true);assert.equal(location.hash,'#empresa=demo-1');assert.ok($('#prompt-build'));
  const build=$('#prompt-build');build.querySelector('[name="authorized"]').checked=true;const submit=new window.Event('submit',{bubbles:true,cancelable:true});Object.defineProperty(submit,'submitter',{value:build.querySelector('button')});build.dispatchEvent(submit);await flush();await flush();
  assert.match($('#prompt-editor').value,/Ateliê Aurora/);assert.match($('#prompt-editor').value,/14\. PENDÊNCIAS E FONTES/);assert.equal($('#prompt-versions').querySelectorAll('option').length,1);
  click('[data-action="tab"][data-tab="commercial"]');assert.ok(!$('#whatsapp-action a'));assert.match($('#whatsapp-action').textContent,/Sem WhatsApp/);
  click('[data-action="favorite"][data-id="demo-1"]');await flush();assert.equal(memory.size,0,'demo nunca se mistura à persistência real');
  click('[data-action="close-detail"]');assert.equal($('#local-query').value,'Aurora');assert.equal(document.querySelectorAll('.business-card').length,1);
  click('[data-action="toggle-demo"]');assert.equal(document.querySelectorAll('.business-card').length,0);
});

test('fluxo DOM/HTTP: busca sem cadastro, salva no navegador e preserva resultados ao recarregar',async()=>{
  const memory=new Map(),tabMemory=new Map();
  globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  globalThis.sessionStorage={getItem:k=>tabMemory.get(k)||null,setItem:(k,v)=>tabMemory.set(k,v),removeItem:k=>tabMemory.delete(k)};
  let sourceCalls=0;
  const setup=async()=>{
    const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
    for(const d of document.querySelectorAll('dialog')){d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;d.dispatchEvent(new window.Event('close'));};}
    const location={hash:'',pathname:'/',search:''};
    class FD extends Map{constructor(form){super();for(const el of form.querySelectorAll('[name]')){if(el.type==='checkbox'&&!el.checked)continue;this.set(el.getAttribute('name'),el.value??'');}}}
    Object.assign(globalThis,{window,document,location,history:{replaceState(){},pushState(){}},FormData:FD});window.innerWidth=1440;
    const submit=form=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    document.querySelector('#search-form').requestSubmit=()=>submit(document.querySelector('#search-form'));
    return {document,submit};
  };
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);
    if(value==='/api/config')return Response.json(publicConfig({}));
    if(value==='/api/search'){
      const response={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);}};
      await handleAPI({url:value,method:options.method,headers:Object.fromEntries(Object.entries(options.headers).map(([key,value])=>[key.toLowerCase(),value])),body:JSON.parse(options.body)},response,{});
      return Response.json(response.body,{status:response.statusCode});
    }
    if(value.includes('/api/interpreter')){sourceCalls++;return Response.json({elements:[{id:42,type:'node',tags:{name:'Café do fluxo de teste',amenity:'cafe','addr:city':'Itapeva'}}]});}
    throw new Error('Chamada inesperada: '+value);
  };
  let {document,submit}=await setup();await import('../public/app.js?automatic-flow');
  submit(document.querySelector('#search-form'));assert.equal(document.querySelector('#auth-form'),null);
  for(let i=0;i<30&&!document.querySelector('.business-card');i++)await new Promise(resolve=>setImmediate(resolve));
  assert.match(document.querySelector('#results').textContent,/Café do fluxo de teste/);
  assert.equal(sourceCalls,1);assert.equal(memory.size,1);assert.equal(tabMemory.size,0);
  ({document}=await setup());await import('../public/app.js?automatic-reload');
  assert.equal(document.querySelector('#account-name').textContent,'Espaço local');
  assert.match(document.querySelector('#results').textContent,/Café do fluxo de teste/);
  assert.equal(memory.size,1,'recarregar preserva a base local');assert.equal(sourceCalls,1,'recarregar não repete a consulta externa');
});
