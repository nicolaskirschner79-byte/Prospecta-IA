export const SEGMENTS = {
  beauty: 'Barbearias e salões de beleza', health: 'Clínicas e consultórios',
  food: 'Restaurantes, lanchonetes e cafeterias', fashion: 'Roupas e acessórios',
  vehicles: 'Concessionárias e veículos', auto: 'Oficinas e serviços automotivos',
  estate: 'Imobiliárias', construction: 'Engenharia, arquitetura e construção',
  fitness: 'Academias e estúdios', pets: 'Pet shops e veterinários',
  accounting: 'Contabilidade', market: 'Mercados e lojas de bairro',
  furniture: 'Móveis e decoração', education: 'Escolas e cursos', other: 'Outros serviços locais'
};
export const DIGITAL = {
  not_found: 'Nenhum site próprio localizado', absent: 'Ausência de site confirmada',
  social: 'Somente redes sociais ou agregadores', improvements: 'Site com oportunidades de melhoria',
  adequate: 'Site adequado nos critérios avaliados', inconclusive: 'Análise inconclusiva'
};
export const STAGES = ['Novo', 'Em análise', 'Selecionado', 'Contatado', 'Em conversa', 'Proposta enviada', 'Fechado', 'Perdido', 'Não contatar'];
export const STATES = { verified: 'Verificado na fonte', user: 'Informado pelo usuário', inference: 'Hipótese', missing: 'Não localizado', conflict: 'Conflitante' };
export const DEFAULT_SETTINGS = {
  appName: 'Prospecta IA', city: 'Itapeva', uf: 'SP', timezone: 'America/Sao_Paulo',
  agency: '', seller: '', portfolio: '', agencyContact: '',
  weights: { digital: 45, operation: 20, fit: 15, contact: 10, interest: 10 },
  thresholds: { high: 80, medium: 60, coverage: 70 }, rulesVersion: 1, retentionDays: 90
};
export const normalizeText = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const clean = (v, max = 4000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max).trim();
export function safeURL(raw, protocols = ['https:', 'http:']) {
  try { const u = new URL(raw); return protocols.includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function e164(raw) {
  const v = String(raw ?? '').trim();
  if (!/^\+?[1-9][\d\s().-]{7,22}$/.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  // País e DDD devem estar presentes. Não adivinhar +55 ou nono dígito.
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
export function whatsappURL(b, message = '') {
  if (b.demo) return null;
  const f = b.fields?.whatsapp;
  if (!f || !['verified', 'user'].includes(f.status) || !f.confirmed) return null;
  const source=b.sources?.find(s=>s.id===f.sourceId),expires=f.expiresAt||source?.expiresAt;
  if(expires&&!(Date.parse(expires)>Date.now()))return null;
  if (f.value?.startsWith('https://wa.me/')) {
    try { const u = new URL(f.value); const n = e164(u.pathname.slice(1)); return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null; } catch { return null; }
  }
  const n = e164(f.value);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}
export function field(value, sourceId, extra = {}) {
  return { value: clean(value), sourceId, status: value ? 'user' : 'missing', observedAt: new Date().toISOString(), verifiedAt: new Date().toISOString(), ...extra };
}
export function get(b, key, fallback = '') { return b.fields?.[key]?.value || fallback; }
export function lastVerified(b){const dates=[...Object.values(b.fields||{}),...Object.values(b.assessments||{})].map(x=>x.verifiedAt).concat((b.audits||[]).map(x=>x.at)).filter(x=>Number.isFinite(Date.parse(x)));return dates.sort().at(-1)||b.createdAt;}
export function newBusiness(values = {}, source = null) {
  const now = new Date().toISOString();
  const s = source || { id: crypto.randomUUID(), label: 'Cadastro manual autorizado', url: '', collectedAt: now, permissions: { retain: true, export: true, ai: true } };
  const fields = Object.fromEntries(['name', 'city', 'uf', 'district', 'address', 'description', 'services', 'hours', 'website', 'phone', 'email', 'whatsapp', 'social', 'visual'].map(k => [k, field(values[k], s.id)]));
  if (!fields.name.value) throw new Error('Informe o nome do comércio.');
  return { id: crypto.randomUUID(), demo: false, segment: SEGMENTS[values.segment] ? values.segment : 'other', fields, sources: [s], assessments: {}, audits: [], scoreHistory: [], prompts: [], events: [], stage: 'Novo', favorite: false, notes: '', nextAction: '', createdAt: now, updatedAt: now, lifecycle: 'active' };
}
export function identityKey(b) {
  return [get(b, 'name'), get(b, 'city'), get(b, 'uf'), get(b, 'address')].map(normalizeText).join('|');
}
export function duplicateCandidates(list, b) {
  return list.filter(x => x.id === b.id || identityKey(x) === identityKey(b) ||
    (normalizeText(get(x, 'name')) === normalizeText(get(b, 'name')) && normalizeText(get(x, 'city')) === normalizeText(get(b, 'city'))));
}
export function parseCSV(text) {
  const rows = []; let row = [], val = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { val += '"'; i++; } else if (!quoted && val) throw new Error('CSV inválido: aspas no meio do campo.'); else quoted = !quoted; }
    else if ((ch === ',' || ch === '\n' || ch === '\r') && !quoted) {
      row.push(val); val = '';
      if (ch !== ',') { if (row.some(x => x.trim())) rows.push(row); row = []; if (ch === '\r' && input[i + 1] === '\n') i++; }
    } else val += ch;
  }
  if (quoted) throw new Error('CSV inválido: aspas não encerradas.');
  row.push(val); if (row.some(x => x.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(x => x.trim());
  if (!headers.includes('name')) throw new Error('O CSV precisa da coluna name. Baixe o modelo.');
  if (rows.length > 200) throw new Error('Importe até 200 registros por arquivo.');
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}
export function csvCell(v) { const s = String(v ?? ''); return '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'; }
export function validateSettings(s) {
  const weights = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.weights).map(k => [k, Number(s.weights?.[k])]));
  if (Object.values(weights).some(v => !Number.isFinite(v) || v < 0 || v > 100) || Object.values(weights).reduce((a,b) => a+b,0) !== 100) throw new Error('Os pesos precisam somar 100 pontos.');
  const t = Object.fromEntries(['high','medium','coverage'].map(k=>[k, Number(s.thresholds?.[k])]));
  if (Object.values(t).some(v=>!Number.isFinite(v)||v<0||v>100) || t.high <= t.medium) throw new Error('Revise os limites de prioridade e cobertura.');
  try { new Intl.DateTimeFormat('pt-BR',{timeZone:s.timezone}); } catch { throw new Error('Fuso horário inválido.'); }
  const days=Number(s.retentionDays); if(!Number.isInteger(days)||days<1||days>3650) throw new Error('Retenção deve ficar entre 1 e 3650 dias.');
  return {...s, weights, thresholds:t, retentionDays:days};
}
