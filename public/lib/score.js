import { DEFAULT_SETTINGS, whatsappURL } from './domain.js';
import { permitted } from './permissions.js';
export const RUBRIC_VERSION='1.0.0';
export const AUDIT_RULES={ https:{group:'availability',points:5}, availability:{group:'availability',points:5}, viewport:{group:'mobile',points:5}, imageAlt:{group:'mobile',points:5}, contact:{group:'conversion',points:5}, cta:{group:'conversion',points:5}, title:{group:'content',points:3}, description:{group:'content',points:2}, performance:{group:'content',points:5} };
export function calculateScore(b, settings=DEFAULT_SETTINGS, now=Date.now()) {
  const a=b.assessments||{}, w=settings.weights, parts=[], pending=[];
  let score=0, covered=0;
  const known=(key)=>{ const x=a[key],states=['useCase','informationNeed','benefit'].includes(key)?['verified','user','inference']:['verified','user']; return Boolean(x && states.includes(x.status) && x.value!==null && x.value!==undefined && Boolean(x.reason?.trim()) && permitted(b,x,'retain',now)); };
  const add=(id,label,value,max,knownMax,why)=>{
    const scaled=Math.round(value*100)/100;
    parts.push({id,label,points:scaled,max,covered:knownMax,reason:why}); score+=scaled; covered+=knownMax;
  };
  const digital=known('digital') ? a.digital.value : 'inconclusive';
  let dp=0, dc=0;
  if (digital==='absent') { dp=45; dc=45; }
  else if (['not_found','social'].includes(digital) && a.digital.sufficient) {dp=35;dc=45;}
  else if (digital==='adequate' && a.digital.sufficient) {dc=45;}
  else if (digital==='improvements') {
    const latest=b.audits?.at(-1);
    if (latest && latest.permissions?.retain && (!latest.expiresAt || Date.parse(latest.expiresAt)>now)) {
      const tests=Object.entries(AUDIT_RULES), total=tests.reduce((s,[,v])=>s+v.points,0);
      const assessed=new Map();
      for (const t of latest.tests || []) if (AUDIT_RULES[t.id] && ['pass','fail'].includes(t.status) && t.evidence) assessed.set(t.id,t);
      dp=[...assessed].reduce((s,[id,t])=>s+(t.status==='fail'?AUDIT_RULES[id].points:0),0);
      dc=45*([...assessed.keys()].reduce((s,id)=>s+AUDIT_RULES[id].points,0)/total);
    }
  }
  if(!dc) pending.push('Verificar a situação digital e registrar evidências suficientes.');
  add('digital','Necessidade digital',dp/45*w.digital,w.digital,dc/45*w.digital, a.digital?.reason||'Situação pendente');
  const op=['recentActivity','consistentInfo'];
  const ok=op.filter(known); add('operation','Evidências de operação',ok.reduce((s,k)=>s+(a[k].value===true?10:0),0)/20*w.operation,w.operation,ok.length/2*w.operation,ok.map(k=>a[k].reason).join(' · ')||'Verificações pendentes');
  op.filter(k=>!known(k)).forEach(k=>pending.push(k==='recentActivity'?'Verificar atividade recente em canal oficial.':'Conferir consistência das informações comerciais.'));
  const fit=['useCase','informationNeed','benefit'], fk=fit.filter(known);
  add('fit','Adequação de um site (hipóteses)',fk.reduce((s,k)=>s+(a[k].value===true?5:0),0)/15*w.fit,w.fit,fk.length/3*w.fit,fk.map(k=>a[k].reason).join(' · ')||'Justificar hipóteses comerciais');
  fit.filter(k=>!known(k)).forEach(k=>pending.push({useCase:'Justificar caso de uso do site.',informationNeed:'Avaliar organização das informações.',benefit:'Identificar benefício específico.'}[k]));
  const wa=b.fields?.whatsapp, channels=['phone','email'];
  const hasWA=permitted(b,wa,'retain',now)&&Boolean(whatsappURL(b));
  const hasOther=channels.some(k=>b.fields?.[k]?.confirmed && permitted(b,b.fields[k],'retain',now));
  const contactKnown=known('contactChecked') || hasWA || hasOther;
  add('contact','Contato comercial utilizável',((hasWA?7:0)+(hasOther?3:0))/10*w.contact,w.contact,contactKnown?w.contact:0,hasWA?'WhatsApp confirmado':hasOther?'Telefone ou e-mail confirmado':'Confirmar canais de contato');
  if(!contactKnown)pending.push('Confirmar canais comerciais.');
  const interest=['interest','nextStep'], ik=interest.filter(known);
  add('interest','Interesse registrado',ik.reduce((s,k)=>s+(a[k].value===true?5:0),0)/10*w.interest,w.interest,ik.length/2*w.interest,ik.map(k=>a[k].reason).join(' · ')||'Sem pesquisa de interesse registrada');
  if(ik.length<2)pending.push('Registrar se houve interesse e próximo passo (zero conhecido é permitido).');
  const coverage=Math.round(covered), total=Math.round(score), identity=known('identity')&&a.identity.value===true&&!['name','city','uf','address','website'].some(k=>b.fields[k]?.status==='conflict');
  if(!identity)pending.push('Confirmar identidade da empresa e da unidade.');
  const excluded=b.stage==='Não contatar'||['closed','duplicate','out_of_scope'].includes(b.lifecycle);
  const eligible=!excluded && identity && coverage>=settings.thresholds.coverage && digital!=='inconclusive' && dc>0;
  const priority=excluded?'excluded':!eligible?'pending':total>=settings.thresholds.high?'high':total>=settings.thresholds.medium?'medium':'low';
  return {score:total,coverage,priority,eligible,parts,pending,reasons:parts.filter(p=>p.points>0).sort((a,b)=>b.points-a.points).slice(0,3).map(p=>p.reason),version:`${RUBRIC_VERSION}/config-${settings.rulesVersion}`,weights:{...w},thresholds:{...settings.thresholds},at:new Date(now).toISOString()};
}
