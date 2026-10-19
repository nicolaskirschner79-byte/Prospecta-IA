import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
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
