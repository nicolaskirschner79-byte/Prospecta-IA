import { normalizeText } from './domain.js';
import { STATES } from './regions.js';

const catalogs=new WeakMap();
export async function loadCities(uf,{fetcher=fetch}={}){
  if(!Object.hasOwn(STATES,uf))throw new Error('Selecione um estado válido.');
  let cache=catalogs.get(fetcher);if(!cache){cache=new Map();catalogs.set(fetcher,cache);}
  if(cache.has(uf))return cache.get(uf);
  const promise=(async()=>{
    const response=await fetcher(`/data/cities/${uf}.json`,{signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw new Error('Não foi possível carregar as cidades. Selecione o estado novamente para tentar.');
    const data=await response.json();
    if(!Array.isArray(data)||!data.length||data.some(row=>!Number.isInteger(row.id)||typeof row.name!=='string'))throw new Error('Catálogo de cidades inválido.');
    return data.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  })();
  cache.set(uf,promise);
  try{return await promise;}catch(error){cache.delete(uf);throw error;}
}

export function createCityPicker(root){
  const input=root.querySelector('input'),list=root.querySelector('[role="listbox"]'),toggle=root.querySelector('button'),help=root.querySelector('[data-city-help]');
  let cities=[],matches=[],active=-1,uf='',generation=0;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  function select(row){input.value=row.name;input.setAttribute('aria-invalid','false');input.setCustomValidity?.('');help.textContent=`${cities.length} cidades em ${uf}`;close();}
  function highlight(index){
    active=index;
    for(const [i,item]of [...list.children].entries())item.setAttribute('aria-selected',String(i===active));
    if(active>=0){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView?.({block:'nearest'});}
  }
  function open(){
    if(input.disabled||!cities.length)return;
    const term=normalizeText(input.value);matches=cities.filter(row=>!term||normalizeText(row.name).includes(term)).slice(0,60);
    list.replaceChildren();
    for(const row of matches){const item=document.createElement('li');item.id=`city-option-${row.id}`;item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.dataset.cityId=String(row.id);item.textContent=row.name;list.append(item);}
    list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));active=-1;
    input.removeAttribute('aria-activedescendant');
    help.textContent=matches.length?`${cities.length} cidades em ${uf} · digite para filtrar`:'Nenhuma cidade encontrada neste estado.';
  }
  input.addEventListener('focus',open);
  input.addEventListener('input',()=>{input.setAttribute('aria-invalid','false');input.setCustomValidity?.('');open();});
  toggle.addEventListener('click',()=>{if(!list.hidden){close();return;}input.value='';input.focus();open();});
  list.addEventListener('pointerdown',event=>event.preventDefault());
  list.addEventListener('click',event=>{const item=event.target.closest('[data-city-id]');const row=matches.find(row=>String(row.id)===item?.dataset.cityId);if(row){select(row);input.focus();close();}});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(list.hidden)open();if(matches.length)highlight((active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length);
    }else if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();select(matches[active]);}
    else if(event.key==='Escape'){event.preventDefault();close();}
    else if(event.key==='Tab')close();
  });
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});
  return {
    async setState(next,preferred=''){
      const token=++generation;uf=next;cities=[];close();input.value='';input.setCustomValidity?.('');input.setAttribute('aria-invalid','false');input.disabled=true;toggle.disabled=true;help.textContent='Carregando cidades…';
      try{
        const data=await loadCities(next);if(token!==generation)return false;
        cities=data;input.disabled=false;toggle.disabled=false;input.placeholder='Digite ou escolha a cidade';
        const row=cities.find(row=>normalizeText(row.name)===normalizeText(preferred));
        if(row)select(row);else help.textContent=`${cities.length} cidades em ${uf} · escolha uma cidade`;
        return true;
      }catch(error){if(token===generation){help.textContent=error.message;input.placeholder='Catálogo indisponível';}return false;}
    },
    validate(){
      const row=cities.find(row=>normalizeText(row.name)===normalizeText(input.value));
      if(row){select(row);return true;}
      const message=`Escolha uma cidade da lista de ${uf||'seu estado'}.`;
      input.setAttribute('aria-invalid','true');input.setCustomValidity?.(message);input.focus();open();help.textContent=message;return false;
    },
    open,
    get state(){return uf;}
  };
}
