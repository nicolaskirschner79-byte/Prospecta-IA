import {DEFAULT_SETTINGS,clean,safeURL} from './domain.js';
import {permitted} from './permissions.js';
import {phoneNumber,websiteKind} from './contacts.js';

const value=(b,key,now)=>{
  const f=b.fields?.[key];
  return ['user','verified'].includes(f?.status)&&permitted(b,f,'retain',now)&&permitted(b,f,'export',now)?clean(f.value,4000):'';
};
const ideas={
  beauty:'apresentar os serviços e trabalhos do espaço e facilitar solicitações de horário',
  health:'organizar os atendimentos, as informações dos profissionais e os canais para solicitar uma consulta',
  food:'apresentar o cardápio e facilitar consultas sobre pedidos e formas de atendimento',
  fashion:'mostrar as coleções e facilitar consultas sobre peças, tamanhos e disponibilidade',
  vehicles:'apresentar os veículos disponíveis e facilitar pedidos de proposta ou visita à loja',
  auto:'explicar os serviços da oficina e facilitar pedidos de orçamento',
  estate:'organizar os imóveis e facilitar consultas e solicitações de visita',
  construction:'apresentar projetos e serviços e facilitar pedidos de orçamento',
  fitness:'apresentar as modalidades e facilitar consultas sobre horários, planos e visitas',
  pets:'apresentar os produtos e serviços para pets e facilitar consultas sobre o atendimento',
  accounting:'explicar os serviços contábeis e facilitar pedidos de proposta de novos clientes',
  market:'apresentar as categorias de produtos, a localização e os canais de atendimento da loja',
  furniture:'apresentar móveis, materiais e projetos e facilitar pedidos de orçamento',
  education:'organizar os cursos e facilitar consultas sobre turmas e matrículas',
  other:'organizar os serviços, a localização e os canais de contato do negócio'
};
export function approach(b,settings=DEFAULT_SETTINGS,now=Date.now()){
  const name=value(b,'name',now)||'seu comércio',city=value(b,'city',now);
  const seller=clean(settings.seller,100),agency=clean(settings.agency,100);
  const intro=seller?`Sou ${seller}${agency?`, da ${agency}`:''}, e trabalho com desenvolvimento de sites.`:agency?`Trabalho com desenvolvimento de sites na ${agency}.`:'Trabalho com desenvolvimento de sites.';
  const site=websiteKind(value(b,'website',now))==='website';
  const social=Boolean(safeURL(value(b,'social',now)))||websiteKind(value(b,'website',now))==='platform';
  const digital=b.assessments?.digital;
  const verifiedAbsent=digital?.value==='absent'&&digital.sufficient&&['user','verified'].includes(digital.status)&&permitted(b,digital,'export',now);
  const context=site?'Se vocês já utilizam um site, a ideia é avaliar se uma melhoria ou página específica faz sentido para esse objetivo.':verifiedAbsent?'Minha proposta é criar um canal próprio para organizar essas informações.':social?'A ideia é ter uma página própria que complemente as redes sociais. Vocês já usam um site para isso?':'Vocês já têm um site próprio que ajude nesse atendimento?';
  const services=value(b,'services',now);
  const detail=services?` Também podemos destacar ${services.replace(/\s+/g,' ').slice(0,140)}${services.length>140?'…':''}.`:'';
  return `Olá! Tudo bem? ${intro}\n\nPensei em uma página para ${name}${city?`, em ${city}`:''}, para ${ideas[b.segment]||ideas.other}.${detail} ${context}\n\nPosso enviar uma sugestão de estrutura para vocês avaliarem, sem compromisso?`;
}
function whatsappNumber(raw){
  const url=safeURL(raw);
  if(url){const u=new URL(url);if(u.hostname==='wa.me')return phoneNumber('+'+u.pathname.slice(1));if(['api.whatsapp.com','web.whatsapp.com'].includes(u.hostname)&&u.pathname==='/send')return phoneNumber('+'+(u.searchParams.get('phone')||'').replace(/^\+/,''));return null;}
  return phoneNumber(raw);
}
export function whatsappDraft(b,settings=DEFAULT_SETTINGS,{message,now=Date.now()}={}){
  if(b.demo||b.stage==='Não contatar'||['closed','duplicate','out_of_scope'].includes(b.lifecycle)||!value(b,'name',now))return null;
  const wa=value(b,'whatsapp',now),explicit=wa&&whatsappNumber(wa);
  const number=explicit||phoneNumber(value(b,'phone',now));if(!number)return null;
  const confirmed=Boolean(explicit&&b.fields.whatsapp.confirmed),published=Boolean(explicit&&b.fields.whatsapp.published);
  const text=message===undefined?approach(b,settings,now):String(message);
  return {url:`https://wa.me/${number.slice(1)}?text=${encodeURIComponent(text)}`,message:text,number,confirmed,published,requiresCheck:!confirmed&&!published};
}
