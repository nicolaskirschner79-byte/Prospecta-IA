import { get,SEGMENTS,DIGITAL,STATES,safeURL,whatsappURL } from './domain.js';
import {evaluateOpportunity} from './opportunity.js';
import {ensureReadyPrompt} from './automatic.js';
import {contactLinks} from './contacts.js';
const paths={
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  bookmark:'<path d="M6 3h12v19l-6-4-6 4z"/>',columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  settings:'<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 3-1 4-1 2-4-1-3-1-4-4-2z"/><circle cx="12" cy="12" r="3"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',plus:'<path d="M12 4v16M4 12h16"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7"/><circle cx="12" cy="12" r="1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',filter:'<path d="M3 5h18M6 12h12M9 19h6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/>',star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  pin:'<path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM21 2v4M19 4h4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',x:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 4 4L19 6"/>',
  phone:'<path d="M5 3h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c0 5-7 2-12-2S0 3 5 3z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',link:'<path d="m10 14 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',brief:'<path d="M7 3h10l4 4v14H3V3h4m10 0v5h4M7 12h10M7 16h7"/>',
  chart:'<path d="M4 20V4m0 16h17M8 16l4-5 4 2 5-7"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
export const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.info}</svg>`;
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={high:'Alta prioridade',medium:'Média prioridade',low:'Baixa prioridade',pending:'Dados insuficientes',excluded:'Fora da abordagem'};
export function date(v,settings,withTime=false){try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',...(withTime?{timeStyle:'short'}:{}),timeZone:settings.timezone}).format(new Date(v));}catch{return 'Não localizado';}}
export function badge(priority){return `<span class="badge ${priority}">${esc(labels[priority])}</span>`;}
export function safeLink(raw,label){const u=safeURL(raw);return u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label||u)}</a>`:'Não localizado';}
export function card(b,settings){
  const s=evaluateOpportunity(b,settings),ready=ensureReadyPrompt(b,settings),name=get(b,'name','Comércio'),initials=name.replace('• Fictício','').split(/\s+/).slice(0,2).map(x=>x[0]).join('');
  const contacts=b.demo?[]:contactLinks(b),score=s.score===null?'—':s.score;
  const contactHTML=contacts.slice(0,4).map(c=>`<a class="contact-chip" href="${esc(c.href)}" ${c.href.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''} title="${esc(c.value)}">${icon(c.kind==='phone'||c.kind==='whatsapp'?'phone':c.kind==='email'?'mail':c.kind==='social'?'link':'globe')}<span>${esc(c.kind==='phone'?c.value:c.label)}</span></a>`).join('');
  return `<article class="business-card" data-business="${esc(b.id)}">${b.demo?'<p class="demo-label">DEMONSTRAÇÃO · EMPRESA FICTÍCIA</p>':''}<div class="card-head"><span class="avatar">${esc(initials)}</span><div class="card-name"><h3>${esc(name)}</h3><p>${esc(SEGMENTS[b.segment])}</p></div><button class="icon-button ${b.favorite?'star':''}" data-action="favorite" data-id="${esc(b.id)}" aria-label="${b.favorite?'Remover dos':'Adicionar aos'} favoritos" aria-pressed="${Boolean(b.favorite)}">${icon('star')}</button></div><div class="lead-overview"><p class="card-location">${icon('pin')}${esc([get(b,'district'),get(b,'city')].filter(Boolean).join(' · ')||'Localização a confirmar')}</p><div class="lead-score ${s.priority}" title="${esc(s.explanation)}" aria-label="Potencial para site: ${score}${s.score===null?'':' de 100'}. ${esc(s.confidenceLabel)} confiança"><strong>${score}${s.score!==null?'<span>/100</span>':''}</strong><small>${s.score===null?'A avaliar':'Potencial para site'}</small></div></div><p class="lead-status">${s.score===null?'Dados insuficientes para pontuar':s.priority==='excluded'?'Fora da abordagem':s.preliminary?'Avaliação inicial · confira os motivos':labels[s.priority]}</p><div class="lead-contacts">${contactHTML||'<span class="contact-missing">Sem contatos publicados nesta fonte</span>'}</div><div class="card-bottom"><button class="button secondary" data-action="detail" data-id="${esc(b.id)}">Ver análise ${icon('arrow')}</button><button class="button primary" data-action="prompt" data-id="${esc(b.id)}">${icon('brief')}${ready?'Prompt pronto':'Ver prompt'}</button></div></article>`;
}
export function fieldDisplay(b,key,settings){const f=b.fields[key];return `<div><dt>${esc({name:'Nome',city:'Cidade',uf:'UF',district:'Bairro',address:'Endereço',hours:'Horários',website:'Domínio encontrado',phone:'Telefone comercial',email:'E-mail',whatsapp:'WhatsApp',social:'Rede social',services:'Serviços/produtos',visual:'Identidade observada'}[key]||key)}</dt><dd>${f?.value?esc(f.value):'Não localizado'}${f?.value?`<br><span class="badge neutral ${f.status==='conflict'?'source-conflict':''}">${esc(STATES[f.status]||'Informado')} · ${date(f.verifiedAt,settings)}</span>`:''}${(f?.conflicts||[]).map(c=>`<br><small class="source-conflict">Outra fonte: ${esc(c.value)} · ${safeLink(c.source,'ver origem')} · ${date(c.at,settings)}</small>`).join('')}</dd></div>`;}
