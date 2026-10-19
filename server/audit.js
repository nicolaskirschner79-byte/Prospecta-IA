import { safeGet, AppError,limitedJSON,validateAuditURL } from './security.js';
export function authorizedAuditHosts(url,env){
  const configured=(env.AUDIT_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(configured.length){validateAuditURL(url,configured);return configured;}
  let host;try{host=new URL(url).hostname;}catch{throw new AppError(400,'INVALID_URL','URL inválida.');}
  // A autorização é confirmada na ficha antes da chamada autenticada. A lista
  // vale apenas para esta análise; DNS público é conferido em cada conexão.
  const base=host.replace(/^www\./,'');
  const hosts=[base,'www.'+base];validateAuditURL(url,hosts);return hosts;
}
const stripped=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
async function runAudit(url,env,{getter=safeGet,fetcher=fetch,signal}={}){
  const allowedHosts=authorizedAuditHosts(url,env);
  const robotsURL=new URL('/robots.txt',url).href;
  const robots=await getter(robotsURL,{allowedHosts,signal});
  // Conservador: qualquer Disallow não vazio interrompe a auditoria leve; revisão humana necessária.
  if(robots.status===401||robots.status===403||robots.status===429||/disallow\s*:\s*\S+/i.test(robots.body))throw new AppError(422,'ROBOTS_REVIEW','Revisão de permissão/robots.txt necessária antes da análise.');
  signal?.throwIfAborted();
  const page=await getter(url,{allowedHosts,signal});
  if(page.status===401||page.status===403||page.status===429||page.status>=500)throw new AppError(422,'INCONCLUSIVE','Não foi possível analisar. O bloqueio/erro não comprova indisponibilidade para visitantes.');
  const html=stripped(page.body),tests=[];
  const add=(id,pass,evidence,impact,suggestion)=>tests.push({id,status:pass?'pass':'fail',evidence,url:page.url,severity:pass?'informação':'moderada',impact,suggestion});
  add('https',page.url.startsWith('https:'),'URL final usa HTTPS.','Conexão protegida.','Manter certificado válido.');
  add('availability',page.status>=200&&page.status<300,`HTTP ${page.status} nesta requisição pontual. Não é monitoramento contínuo.`,'Pode dificultar o acesso nesta URL.','Verificar destino e resposta do servidor.');
  add('viewport',/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html),'Presença de meta viewport no HTML recebido. Não é teste visual mobile.','Pode afetar a escala em telas menores.','Incluir viewport e testar o layout em aparelhos reais.');
  const images=html.match(/<img\b[^>]*>/gi)||[];
  add('imageAlt',!images.some(i=>!/\balt\s*=\s*["'][^"']*["']/i.test(i)),`${images.length} imagens no HTML; ${images.filter(i=>!/\balt\s*=\s*["'][^"']*["']/i.test(i)).length} sem atributo alt. Não avalia a qualidade do texto alternativo.`,'Pode prejudicar a compreensão por leitores de tela.','Adicionar textos alternativos úteis, ou alt vazio para imagens decorativas.');
  const links=html.match(/<a\b[^>]*>/gi)||[];
  const hasContact=links.some(x=>/href\s*=\s*["'](?:tel:|mailto:|https:\/\/(?:wa\.me|api\.whatsapp\.com)\/)/i.test(x));
  tests.push({id:'contact',status:hasContact?'pass':'unknown',evidence:hasContact?'Link de contato encontrado no HTML; destino não foi validado.':'Não foi detectado um link de contato no HTML; conteúdo dinâmico não avaliado.',url:page.url});
  tests.push({id:'cta',status:'unknown',evidence:'Clareza e funcionamento dos CTAs exigem inspeção humana.',url:page.url});
  add('title',/<title\b[^>]*>[^<\s][\s\S]*?<\/title>/i.test(html),'Verificação da presença de título não vazio no HTML.','Título ajuda a identificar a página.','Escrever um título descritivo com nome e contexto local.');
  add('description',/<meta\b(?=[^>]*name\s*=\s*["']description["'])(?=[^>]*content\s*=\s*["'][^"']+)[^>]*>/i.test(html),'Verificação de meta description preenchida.','Descrição pode ajudar a apresentar o conteúdo nos buscadores.','Adicionar uma descrição precisa, sem prometer posição.');
  let performance=null;
  if(env.PAGESPEED_API_KEY){
    const endpoint=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');endpoint.searchParams.set('url',page.url);endpoint.searchParams.set('strategy','mobile');endpoint.searchParams.set('key',env.PAGESPEED_API_KEY);
    try{
      signal?.throwIfAborted();
      const r=await fetcher(endpoint,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
      if(!r.ok)performance={state:r.status===429?'limit':r.status===400||r.status===403?'invalid_credential':'unavailable',strategy:'mobile'};
      else{const data=await limitedJSON(r,4000000),score=data.lighthouseResult?.categories?.performance?.score;performance={state:typeof score==='number'?'available':'partial',strategy:'mobile',score:typeof score==='number'?Math.round(score*100):null,at:new Date().toISOString()};}
    }catch{performance={state:'unavailable',strategy:'mobile'};}
  }
  tests.push({id:'performance',status:performance?.score!=null?(performance.score<50?'fail':'pass'):'unknown',evidence:performance?.score!=null?`Lighthouse mobile: ${performance.score}/100, medição de laboratório pontual.`:'Desempenho não medido.',url:page.url});
  return {id:crypto.randomUUID(),at:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400000).toISOString(),url:page.url,tests,performance,permissions:{retain:true,export:true,ai:true},limits:'Uma página + robots.txt. Sem execução de JavaScript, inspeção visual, rastreio de links ou validação de formulário. Critérios unknown não pontuam.',state:'partial'};
}
export async function auditWebsite(url,env,options={}){
  let timer;const controller=new AbortController();
  try{return await Promise.race([runAudit(url,env,{...options,signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppError(504,'TIMEOUT','Tempo total da auditoria excedido. Resultado inconclusivo.'));},45000);})]);}
  finally{clearTimeout(timer);controller.abort();}
}
