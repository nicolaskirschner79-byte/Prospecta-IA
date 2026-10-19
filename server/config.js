// Configuração pública desta instalação. A chave publicável não concede acesso
// aos registros: a autorização continua nas políticas RLS do Supabase.
const DEPLOYMENT = {
  SUPABASE_URL: 'https://aotlmtaqgyxojssjxubm.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SiOS0KSEPgrveKR3W4ZMLA_VGpCgLQI',
  PROVIDER_CONTACT: 'https://github.com/nicolaskirschner79-byte/Prospecta-IA'
};

export function resolveConfig(env = process.env) {
  const customCloud = Boolean(env.SUPABASE_URL?.trim() || env.SUPABASE_PUBLISHABLE_KEY?.trim());
  const cloud = env.DISABLE_CLOUD === 'true' ? {} : customCloud ? env : DEPLOYMENT;
  return {
    ...env,
    ENABLE_OSM: env.ENABLE_OSM || 'true',
    PROVIDER_CONTACT: env.PROVIDER_CONTACT?.trim() || DEPLOYMENT.PROVIDER_CONTACT,
    SUPABASE_URL: cloud.SUPABASE_URL?.trim().replace(/\/$/, '') || '',
    SUPABASE_PUBLISHABLE_KEY: cloud.SUPABASE_PUBLISHABLE_KEY?.trim() || '',
    AUDIT_MODE: env.AUDIT_MODE || 'authorized'
  };
}
