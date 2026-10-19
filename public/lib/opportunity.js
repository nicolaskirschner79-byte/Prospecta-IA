import {DEFAULT_SETTINGS,safeURL,whatsappURL,normalizeText} from './domain.js';
import {permitted,canRetain} from './permissions.js';
import {calculateScore} from './score.js';
import {siteProfile} from './site-profiles.js';
import {contactLinks,websiteKind} from './contacts.js';

export const OPPORTUNITY_VERSION='3.0.0';
export function evaluateOpportunity(b,settings=DEFAULT_SETTINGS,now=Date.now()){
  const evidence=calculateScore(b,settings,now),a=b.assessments||{},profile=siteProfile(b.segment),parts=[];
  const value=key=>{const f=b.fields?.[key];return f?.status!=='conflict'&&permitted(b,f,'retain',now)?f.value:'';};
  const known=(key,inference=false)=>{const f=a[key];return f&&['user','verified',...(inference?['inference']:[])].includes(f.status)&&f.value!==null&&f.value!==undefined&&Boolean(f.reason?.trim())&&permitted(b,f,'retain',now);};
  const add=(id,label,points,max,reason,mode)=>parts.push({id,label,points:Math.round(points*100)/100,max,reason,mode});
  const w=settings.weights,site=websiteKind(value('website'))==='website'?safeURL(value('website')):null,social=Boolean(safeURL(value('social')))||websiteKind(value('website'))==='platform';
  const digital=evidence.parts.find(p=>p.id==='digital');
  if(digital.covered>0)add('digital','Oportunidade digital',digital.points,w.digital,digital.reason,'evidence');
  else add('digital','Oportunidade digital',(site?5:social?15:12)/45*w.digital,w.digital,
    site?'Há um domínio cadastrado; a qualidade e a necessidade de reformulação ainda não foram verificadas.':social?'Há rede social cadastrada e nenhum site informado nesta fonte. Investigar a necessidade de um canal próprio.':'O cadastro não informa site. É uma oportunidade de investigação, sem comprovar que a empresa não possui site.','preliminary');
  const dataKeys=['address','hours','description','services','phone','email','website','social'];
  const available=dataKeys.filter(key=>Boolean(value(key))),completeness=available.length/dataKeys.length;
  const metadata=b.providerMeta||{},age=metadata.updatedAt?(now-Date.parse(metadata.updatedAt))/86400000:null;
  const dataPoints=Math.min(10,available.length*1.25+(Number.isFinite(age)&&age>=0&&age<90?1:0));
  const opKeys=['recentActivity','consistentInfo'];
  const operation=opKeys.reduce((sum,key)=>sum+(known(key)?a[key].value===true?10:0:dataPoints/2),0);
  add('operation','Dados comerciais disponíveis',operation/20*w.operation,w.operation,
    `${available.length} informações específicas disponíveis: ${available.map(key=>({address:'endereço',hours:'horários',description:'descrição',services:'serviços',phone:'telefone',email:'e-mail',website:'site',social:'rede social'}[key])).join(', ')||'nenhuma'}. ${Number.isFinite(age)?'Atualização do catálogo: '+metadata.updatedAt.slice(0,10)+'. ':''}Dados publicados não comprovam operação recente.`,opKeys.every(key=>known(key))?'evidence':'preliminary');
  const segmentFit={beauty:[4.5,4,4],health:[4.5,4,4.5],food:[5,4,3],fashion:[5,4.5,4],vehicles:[5,5,5],auto:[4,4,3.5],estate:[5,5,5],construction:[5,4.5,5],fitness:[4,4,4.5],pets:[4,4,4],accounting:[5,4,5],market:[3,3,2],furniture:[5,4.5,4.5],education:[5,4.5,4],other:[2,2,2]};
  const fitKeys=['useCase','informationNeed','benefit'],model=segmentFit[b.segment]||segmentFit.other;
  const fit=fitKeys.reduce((sum,key,index)=>sum+(known(key,true)?a[key].value===true?5:0:model[index]),0);
  add('fit','Adequação da solução ao comércio',fit/15*w.fit,w.fit,
    `Modelo proposto: ${profile.objective}. ${profile.angle} ${metadata.category?'Categoria publicada: '+metadata.category+'. ':''}A adequação é uma hipótese, não interesse confirmado.`,fitKeys.every(key=>known(key,true))?'evidence':'hypothesis');
  const confirmedWA=Boolean(b.fields?.whatsapp?.confirmed)&&Boolean(whatsappURL(b))&&permitted(b,b.fields?.whatsapp,'retain',now);
  const confirmedOther=['phone','email'].some(key=>Boolean(value(key))&&b.fields[key].confirmed);
  const contactChecked=known('contactChecked');
  const publishedContact=['phone','email'].some(key=>Boolean(value(key)));
  const channels=contactLinks(b,now),channelKinds=new Set(channels.map(c=>c.kind));
  const contact=confirmedWA||confirmedOther||contactChecked?((confirmedWA?7:0)+(confirmedOther?3:0)):Math.min(7,(channelKinds.has('phone')?3:0)+(channelKinds.has('email')?2:0)+(channelKinds.has('social')?1:0)+(channelKinds.has('whatsapp')?4:0));
  add('contact','Caminho para contato',contact/10*w.contact,w.contact,
    confirmedWA?'WhatsApp confirmado para revisão da abordagem.':confirmedOther?'Telefone ou e-mail comercial confirmado.':contactChecked?'Verificação de contato registrada; nenhum canal confirmado utilizável.':publishedContact?'Telefone ou e-mail publicado; confirmar titularidade e atualidade antes de abordar.':social?'Rede social publicada; confirmar que pertence ao negócio.':'Nenhum canal comercial disponível nesta amostra.',confirmedWA||confirmedOther||contactChecked?'evidence':'preliminary');
  const interestKeys=['interest','nextStep'];
  const interest=interestKeys.reduce((sum,key)=>sum+(known(key)&&a[key].value===true?5:0),0);
  add('interest','Sinais de negociação',interest/10*w.interest,w.interest,
    interestKeys.filter(key=>known(key)).map(key=>a[key].reason).join(' · ')||'Ainda não há interesse nem próximo passo registrados. Orçamento e decisão de compra são desconhecidos.','evidence');
  const declined=known('interest')&&a.interest.value===false;
  const name=normalizeText(value('name'));
  const publicInstitution=b.segment==='education'&&/^(escola|creche)\s+(estadual|municipal|publica)\b/.test(name)||b.segment==='health'&&/^(ubs\b|unidade basica de saude\b)/.test(name);
  const excluded=evidence.priority==='excluded'||b.stage==='Perdido'||b.stage==='Fechado'||declined||publicInstitution;
  const conflict=['name','city','uf','address','website'].some(key=>b.fields?.[key]?.status==='conflict');
  const sufficient=available.length>=2&&channels.length>0||evidence.coverage>0;
  const eligible=!excluded&&!conflict&&canRetain(b)&&sufficient&&!(known('identity')&&a.identity.value===false);
  const calculated=Math.min(100,Math.round(parts.reduce((sum,p)=>sum+p.points,0)));
  const score=excluded?0:sufficient?calculated:null;
  const priority=excluded?'excluded':!eligible?'pending':score>=settings.thresholds.high?'high':score>=settings.thresholds.medium?'medium':'low';
  const confidence=evidence.eligible&&evidence.coverage>=80?'high':known('identity')&&a.identity.value===true&&evidence.coverage>=40?'medium':'low';
  const confidenceLabel={high:'Alta',medium:'Média',low:'Baixa'}[confidence];
  const preliminary=parts.some(p=>p.mode!=='evidence')||!evidence.eligible;
  let nextAction=known('interest')&&a.interest.value===true?`Validar escopo, orçamento e decisão; apresentar uma proposta para ${profile.objective.toLowerCase()}.`:
    !site&&digital.covered===0?`Confirmar se já existe site e apresentar a ideia: ${profile.objective.toLowerCase()}.`:
    site&&digital.covered===0?'Confirmar que o domínio pertence à empresa e verificar melhorias antes de propor uma reformulação.':`Validar com a empresa a proposta: ${profile.objective.toLowerCase()}.`;
  if(!publishedContact&&!confirmedWA&&!social)nextAction='Localizar e confirmar um canal oficial de contato. '+nextAction;
  if(known('interest')&&a.interest.value===false)nextAction='Respeitar a resposta registrada e revisar se existe autorização ou motivo para um próximo contato.';
  if(!sufficient&&!excluded)nextAction='Ainda não há dados individuais suficientes para atribuir uma nota. Atualize os contatos e a presença digital deste comércio.';
  else if(!eligible)nextAction=publicInstitution?'O nome do cadastro indica uma escola ou unidade de saúde pública. Conferir a natureza da instituição; fora da prioridade de comércios privados.':declined?'Respeitar a resposta de falta de interesse registrada. Retomar somente se houver novo contexto ou iniciativa do comércio.':excluded?'Registro fora da prospecção ativa.':'Resolver a identidade, os conflitos ou a validade das fontes antes da abordagem.';
  return {score,priority,eligible,sufficient,parts,coverage:evidence.coverage,dataCoverage:Math.round(completeness*100),confidence,confidenceLabel,preliminary,
    reasons:parts.filter(p=>p.points>0).sort((x,y)=>y.points-x.points).slice(0,3).map(p=>p.id==='fit'&&p.mode==='hypothesis'?profile.angle:p.reason),pending:evidence.pending,
    version:`${OPPORTUNITY_VERSION}/config-${settings.rulesVersion}`,at:new Date(now).toISOString(),evidenceScore:evidence.score,
    probability:null,explanation:sufficient?'Potencial de prospecção baseado nos dados deste comércio, no tipo de site proposto e nos canais disponíveis. A nota não é uma porcentagem de fechamento; interesse, orçamento e decisão precisam de contato real.':'Dados insuficientes para uma avaliação individual. Uma nota repetida ou baseada apenas no nome e na cidade não estimaria a chance de fechar contrato.',
    offer:profile.objective,nextAction};
}
