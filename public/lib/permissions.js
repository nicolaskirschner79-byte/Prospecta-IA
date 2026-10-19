import { get, csvCell } from './domain.js';
export function permitted(b, item, action = 'export', now = Date.now()) {
  if (!item || item.status === 'missing' || item.status==='conflict'&&action!=='retain') return false;
  const source = b.sources?.find(s => s.id === item.sourceId);
  const expiryOK=[item.expiresAt,source?.expiresAt].every(expires=>!expires||(Number.isFinite(Date.parse(expires))&&Date.parse(expires)>now));
  return source?.permissions?.[action]===true && (!item.permissions||item.permissions[action]===true) && expiryOK;
}
export function promptAllowed(b,p,action='export'){
  if(!p||p.permissions?.[action]!==true||(p.expiresAt&&!(Date.parse(p.expiresAt)>Date.now())))return false;
  return (p.sourceIds||[]).every(id=>{const s=b.sources?.find(x=>x.id===id);return s?.permissions?.[action]===true&&(!s.expiresAt||Date.parse(s.expiresAt)>Date.now());});
}
export function projectBusiness(b, action = 'export') {
  const fields = Object.fromEntries(Object.entries(b.fields || {}).filter(([,v]) => permitted(b,v,action)));
  const assessments = Object.fromEntries(Object.entries(b.assessments || {}).filter(([,v]) => permitted(b,v,action)));
  const ids = new Set([...Object.values(fields), ...Object.values(assessments)].map(x=>x.sourceId));
  const audits = (b.audits || []).filter(a=>a.permissions?.[action]===true);
  // Prompt editor/history may include user-added content; exclude when its permission grant is absent.
  const prompts = (b.prompts || []).filter(p=>promptAllowed(b,p,action));
  const scoreHistory=(b.scoreHistory||[]).filter(p=>!p.expiresAt||Date.parse(p.expiresAt)>Date.now());
  prompts.forEach(p=>(p.sourceIds||[]).forEach(id=>ids.add(id)));
  return {...b, fields, assessments, sources:(b.sources||[]).filter(s=>ids.has(s.id)), audits, prompts,scoreHistory};
}
export function canRetain(b) { return permitted(b,b.fields?.name,'retain'); }
export function exportCSV(list) {
  const eligible = list.filter(b=>!b.demo && permitted(b,b.fields?.name,'export'));
  const columns = ['name','segment','city','uf','district','website','phone','email','whatsapp','stage','source','license'];
  return '\uFEFF'+columns.map(csvCell).join(',')+'\r\n'+eligible.map(b=>{
    const x=projectBusiness(b); const row={...Object.fromEntries(Object.keys(x.fields).map(k=>[k,get(x,k)])),segment:x.segment,stage:x.stage,source:x.sources.map(s=>s.url||s.label).join(' | '),license:x.sources.map(s=>s.license||'Uso autorizado pelo usuário').join(' | ')};
    return columns.map(k=>csvCell(row[k]||'')).join(',');
  }).join('\r\n');
}
