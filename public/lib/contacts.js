import {safeURL} from './domain.js';
import {permitted} from './permissions.js';
export function phoneNumber(raw){
  const text=String(raw||'').trim();
  if(!/^[+\d\s().-]+$/.test(text))return null;
  const digits=text.replace(/\D/g,'');
  if(digits.startsWith('55')&&[12,13].includes(digits.length)&&/^[1-9]{2}/.test(digits.slice(2)))return '+'+digits;
  if(digits.startsWith('55'))return null;
  if(text.startsWith('+')&&/^[1-9]\d{7,14}$/.test(digits))return '+'+digits;
  return null;
}
export const emailAddress=raw=>{const text=String(raw||'').trim();return /^[^\s@<>\r\n?]+@[^\s@<>\r\n?]+\.[^\s@<>\r\n?]+$/.test(text)&&text.length<255?text:null;};
export function websiteKind(raw){
  const url=safeURL(raw);if(!url)return 'missing';
  const host=new URL(url).hostname.replace(/^www\./,'');
  if(/(^|\.)(facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|wa\.me|whatsapp\.com|linktr\.ee|google\.com|google\.com\.br|ifood\.com\.br|tripadvisor\.com|tripadvisor\.com\.br|monetizze\.com\.br|hotmart\.com)$/.test(host))return 'platform';
  return 'website';
}
export function contactLinks(b,now=Date.now()){
  if(b.demo)return [];
  const value=key=>{const f=b.fields?.[key];return f?.status!=='conflict'&&permitted(b,f,'retain',now)?f.value:'';};
  const links=[],phone=phoneNumber(value('phone')),email=emailAddress(value('email'));
  if(phone)links.push({kind:'phone',label:'Ligar',href:'tel:'+phone,value:value('phone')});
  const wa=value('whatsapp');
  if(wa&&(b.fields.whatsapp.confirmed||b.fields.whatsapp.published)){
    let number=phoneNumber(wa);const url=safeURL(wa);
    if(url&&new URL(url).hostname==='wa.me')number=phoneNumber('+'+new URL(url).pathname.slice(1));
    if(number)links.push({kind:'whatsapp',label:'WhatsApp',href:'https://wa.me/'+number.slice(1),value:wa});
  }
  if(email)links.push({kind:'email',label:'E-mail',href:'mailto:'+email,value:email});
  const site=safeURL(value('website')),social=safeURL(value('social'));
  if(site)links.push({kind:'website',label:websiteKind(site)==='website'?'Site':'Página',href:site,value:site});
  if(social&&social!==site)links.push({kind:'social',label:'Rede social',href:social,value:social});
  const seen=new Set();return links.filter(link=>{if(seen.has(link.href))return false;seen.add(link.href);return true;});
}
