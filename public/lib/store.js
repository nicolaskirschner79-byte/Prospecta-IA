import { DEFAULT_SETTINGS } from './domain.js';
import { canRetain, projectBusiness } from './permissions.js';
import { authSession,saveCloud,saveCloudBatch,deleteCloud,saveCloudSettings } from './supabase.js';
import {prepareBusinesses,ensureReadyPrompt} from './automatic.js';
const KEY='prospecta.local.v1';
// O texto automático é reconstruído a partir dos dados ao carregar. Isso evita
// multiplicar o armazenamento local e a transferência para a conta por lead.
const storageBusiness=b=>projectBusiness({...b,prompts:(b.prompts||[]).filter(p=>!p.automatic)},'retain');
export function readLocal(){
  try {const x=JSON.parse(localStorage.getItem(KEY)||'{}'),settings={...structuredClone(DEFAULT_SETTINGS),...x.settings};return {businesses:prepareBusinesses(Array.isArray(x.businesses)?x.businesses.filter(canRetain):[],settings),settings};}
  catch{return {businesses:[],settings:structuredClone(DEFAULT_SETTINGS),error:'Não foi possível ler os dados locais. Exporte uma cópia antes de limpar o armazenamento.'};}
}
export function writeLocal(businesses,settings){
  const cutoff=Date.now()-settings.retentionDays*86400000;
  const allowed=businesses.filter(b=>!b.demo&&canRetain(b)&&Date.parse(b.updatedAt)>cutoff).map(storageBusiness);
  localStorage.setItem(KEY,JSON.stringify({businesses:allowed,settings}));
}
export async function persist(b,businesses,settings){
  if(b.demo)return;
  if(!canRetain(b))throw new Error('Este registro não possui permissão vigente de retenção.');
  ensureReadyPrompt(b,settings);
  if(authSession())await saveCloud(storageBusiness(b));else writeLocal(businesses,settings);
}
export async function persistBatch(added,businesses,settings){
  if(added.some(b=>b.demo||!canRetain(b)))throw new Error('Lote contém registro sem permissão de retenção.');
  prepareBusinesses(added,settings);
  if(authSession())await saveCloudBatch(added.map(storageBusiness));else writeLocal(businesses,settings);
}
export async function remove(b,businesses,settings){if(b.demo)return;if(authSession())await deleteCloud(b.id);else writeLocal(businesses,settings);}
export async function persistSettings(settings,businesses){if(authSession())await saveCloudSettings(settings);else writeLocal(businesses,settings);}
