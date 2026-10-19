import {DEFAULT_SETTINGS,safeURL,whatsappURL} from './domain.js';
import {permitted,canRetain} from './permissions.js';
import {calculateScore} from './score.js';
import {siteProfile} from './site-profiles.js';

export const OPPORTUNITY_VERSION='2.0.0';
export function evaluateOpportunity(b,settings=DEFAULT_SETTINGS,now=Date.now()){
  const evidence=calculateScore(b,settings,now),a=b.assessments||{},profile=siteProfile(b.segment),parts=[];
  const value=key=>{const f=b.fields?.[key];return f?.status!=='conflict'&&permitted(b,f,'retain',now)?f.value:'';};
  const known=(key,inference=false)=>{const f=a[key];return f&&['user','verified',...(inference?['inference']:[])].includes(f.status)&&f.value!==null&&f.value!==undefined&&Boolean(f.reason?.trim())&&permitted(b,f,'retain',now);};
  const add=(id,label,points,max,reason,mode)=>parts.push({id,label,points:Math.round(points*100)/100,max,reason,mode});
  const w=settings.weights,site=safeURL(value('website')),social=Boolean(safeURL(value('social')));
  const digital=evidence.parts.find(p=>p.id==='digital');
  if(digital.covered>0)add('digital','Oportunidade digital',digital.points,w.digital,digital.reason,'evidence');
  else add('digital','Oportunidade digital',(site?5:social?15:12)/45*w.digital,w.digital,
    site?'Há um domínio cadastrado; a qualidade e a necessidade de reformulação ainda não foram verificadas.':social?'Há rede social cadastrada e nenhum site informado nesta fonte. Investigar a necessidade de um canal próprio.':'O cadastro não informa site. É uma oportunidade de investigação, sem comprovar que a empresa não possui site.','preliminary');
  const opKeys=['recentActivity','consistentInfo'];
  const dataKeys=['name','city','address','hours','description','services'];
  const completeness=dataKeys.filter(key=>Boolean(value(key))).length/dataKeys.length;
  let operation=0;
  for(const key of opKeys)operation+=known(key)?(a[key].value===true?10:0):completeness*4;
  add('operation','Informações e operação',operation/20*w.operation,w.operation,
    opKeys.every(key=>known(key))?opKeys.map(key=>a[key].reason).join(' · '):`${dataKeys.filter(key=>Boolean(value(key))).length} de ${dataKeys.length} informações básicas publicadas. Completude do cadastro não comprova atividade recente; verificações registradas prevalecem.`,opKeys.every(key=>known(key))?'evidence':'preliminary');
  const fitKeys=['useCase','informationNeed','benefit'];
  const fit=fitKeys.reduce((sum,key)=>sum+(known(key,true)?a[key].value===true?5:0:b.segment==='other'?2:5),0);
  add('fit','Utilidade de um site',fit/15*w.fit,w.fit,
    fitKeys.every(key=>known(key,true))?fitKeys.map(key=>a[key].reason).join(' · '):`Hipótese para este segmento: ${profile.angle} Objetivo proposto: ${profile.objective.toLowerCase()}. Não indica interesse já manifestado.`,fitKeys.every(key=>known(key,true))?'evidence':'hypothesis');
  const confirmedWA=Boolean(whatsappURL(b))&&permitted(b,b.fields?.whatsapp,'retain',now);
  const confirmedOther=['phone','email'].some(key=>Boolean(value(key))&&b.fields[key].confirmed);
  const contactChecked=known('contactChecked');
  const publishedContact=['phone','email'].some(key=>Boolean(value(key)));
  const contact=confirmedWA||confirmedOther||contactChecked?((confirmedWA?7:0)+(confirmedOther?3:0)):publishedContact?3:social?1:0;
  add('contact','Caminho para contato',contact/10*w.contact,w.contact,
    confirmedWA?'WhatsApp confirmado para revisão da abordagem.':confirmedOther?'Telefone ou e-mail comercial confirmado.':contactChecked?'Verificação de contato registrada; nenhum canal confirmado utilizável.':publishedContact?'Telefone ou e-mail publicado; confirmar titularidade e atualidade antes de abordar.':social?'Rede social publicada; confirmar que pertence ao negócio.':'Nenhum canal comercial disponível nesta amostra.',confirmedWA||confirmedOther||contactChecked?'evidence':'preliminary');
  const interestKeys=['interest','nextStep'];
  const interest=interestKeys.reduce((sum,key)=>sum+(known(key)&&a[key].value===true?5:0),0);
  add('interest','Sinais de negociação',interest/10*w.interest,w.interest,
    interestKeys.filter(key=>known(key)).map(key=>a[key].reason).join(' · ')||'Ainda não há interesse nem próximo passo registrados. Orçamento e decisão de compra são desconhecidos.','evidence');
  const declined=known('interest')&&a.interest.value===false;
  const excluded=evidence.priority==='excluded'||b.stage==='Perdido'||b.stage==='Fechado'||declined;
  const conflict=['name','city','uf','address','website'].some(key=>b.fields?.[key]?.status==='conflict');
  const eligible=!excluded&&!conflict&&canRetain(b)&&!(known('identity')&&a.identity.value===false);
  const score=excluded?0:Math.min(100,Math.round(parts.reduce((sum,p)=>sum+p.points,0)));
  const priority=excluded?'excluded':!eligible?'pending':score>=settings.thresholds.high?'high':score>=settings.thresholds.medium?'medium':'low';
  const confidence=evidence.eligible&&evidence.coverage>=80?'high':known('identity')&&a.identity.value===true&&evidence.coverage>=40?'medium':'low';
  const confidenceLabel={high:'Alta',medium:'Média',low:'Baixa'}[confidence];
  const preliminary=parts.some(p=>p.mode!=='evidence')||!evidence.eligible;
  let nextAction=known('interest')&&a.interest.value===true?`Validar escopo, orçamento e decisão; apresentar uma proposta para ${profile.objective.toLowerCase()}.`:
    !site&&digital.covered===0?`Confirmar se já existe site e apresentar a ideia: ${profile.objective.toLowerCase()}.`:
    site&&digital.covered===0?'Confirmar que o domínio pertence à empresa e verificar melhorias antes de propor uma reformulação.':`Validar com a empresa a proposta: ${profile.objective.toLowerCase()}.`;
  if(!publishedContact&&!confirmedWA&&!social)nextAction='Localizar e confirmar um canal oficial de contato. '+nextAction;
  if(known('interest')&&a.interest.value===false)nextAction='Respeitar a resposta registrada e revisar se existe autorização ou motivo para um próximo contato.';
  if(!eligible)nextAction=declined?'Respeitar a resposta de falta de interesse registrada. Retomar somente se houver novo contexto ou iniciativa do comércio.':excluded?'Registro fora da prospecção ativa.':'Resolver a identidade, os conflitos ou a validade das fontes antes da abordagem.';
  return {score,priority,eligible,parts,coverage:evidence.coverage,dataCoverage:Math.round(completeness*100),confidence,confidenceLabel,preliminary,
    reasons:parts.filter(p=>p.points>0).sort((x,y)=>y.points-x.points).slice(0,3).map(p=>p.id==='fit'&&p.mode==='hypothesis'?profile.angle:p.reason),pending:evidence.pending,
    version:`${OPPORTUNITY_VERSION}/config-${settings.rulesVersion}`,at:new Date(now).toISOString(),evidenceScore:evidence.score,
    probability:null,explanation:'Potencial comercial calculado por regras. A nota não é uma porcentagem de fechamento; a chance real depende de interesse, orçamento e decisão ainda não observados.',
    offer:profile.objective,nextAction};
}
