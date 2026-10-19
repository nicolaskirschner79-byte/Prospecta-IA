import {BRIEFING_VERSION,generateBriefing,generateForAI} from './briefing.js';
import {projectBusiness,permitted,promptAllowed,canRetain} from './permissions.js';

const fingerprint=text=>{let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);};
export function ensureReadyPrompt(b,settings){
  if(!canRetain(b))return null;
  b.prompts=(b.prompts||[]).filter(p=>promptAllowed(b,p,'retain'));
  const retained=projectBusiness({...b,prompts:[]},'retain');
  const destination=permitted(retained,retained.fields?.name,'ai')&&permitted(retained,retained.fields?.name,'export')?'ai':'internal';
  const scoped=projectBusiness(projectBusiness(retained,destination==='ai'?'ai':'export'),'export');
  if(!scoped.fields.name)return null;
  const inputKey=fingerprint(JSON.stringify({version:BRIEFING_VERSION,segment:scoped.segment,fields:scoped.fields,sources:scoped.sources,
    settings:{timezone:settings.timezone,agency:settings.agency,seller:settings.seller,portfolio:settings.portfolio},destination,demo:b.demo}));
  const ready=b.prompts.find(p=>p.automatic&&p.inputKey===inputKey&&p.generatorVersion===BRIEFING_VERSION&&promptAllowed(b,p,'export')&&(destination!=='ai'||promptAllowed(b,p,'ai')));
  if(ready)return ready;
  const expires=[...scoped.sources,...Object.values(scoped.fields),...Object.values(scoped.assessments)].map(item=>item.expiresAt).filter(Boolean).sort();
  const prompt={id:`auto-${b.id}-${inputKey}`,automatic:true,generatorVersion:BRIEFING_VERSION,inputKey,destination,
    text:(destination==='ai'?generateForAI:generateBriefing)(retained,settings),options:{},at:new Date().toISOString(),
    sourceIds:scoped.sources.map(source=>source.id),expiresAt:expires[0]||null,permissions:{retain:true,export:true,ai:destination==='ai'}};
  b.prompts=[...b.prompts.filter(p=>!p.automatic),prompt].slice(-20);
  return prompt;
}
export function prepareBusinesses(businesses,settings){for(const b of businesses)ensureReadyPrompt(b,settings);return businesses;}
