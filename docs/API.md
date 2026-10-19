# Contratos do MVP

Respostas JSON, UTF-8. Erros, POST e operações autenticadas usam `Cache-Control: no-store`. GET de busca bem-sucedido pode ser armazenado pela CDN do Vercel, sem dados de conta. Backend local e serverless compartilham `handleAPI`. Sem CORS público. Na aplicação use mesma origem.

## HTTP

| Operação | Contrato |
|---|---|
| `GET /api/config` | público; `{search, searchAccess:'public', audit, ai:'template', access, supabase:{url,key}|null}`. Somente URL/chave **publicável** Supabase; nunca acesso privado/PageSpeed/segredos |
| `GET /api/search` | público; parâmetros `city`, `uf`, `query`, `district`, `segments` (IDs separados por vírgula). Mesmo resultado da busca POST. Cache CDN por até 600 s, com revalidação em segundo plano e data original preservada |
| `POST /api/search` | público, sem autenticação; `{city:string,uf:string,query?:string,district?:string,segments?:string[]}`; resposta `{state,businesses:Business[],nextCursor:null,partial:true,notice,attribution,licenseURL}` |
| `POST /api/details` | público, sem autenticação; `{id:'osm-node-123'}` (ou way/relation); para Overture, `{id:'overture-UUID',city,uf,location:{lon,lat}}`; `{business:Business,state}`. Interface revisa diferenças em vez de sobrescrever |
| `POST /api/audit` | `{url:'https://dominio-autorizado',authorized:true}`; `{id,at,expiresAt,url,tests,performance,permissions,limits,state:'partial'}` |

A instalação resolve automaticamente URL/chave publicável do projeto Prospecta IA e identificação da fonte em `server/config.js`; variáveis de ambiente são substituições opcionais. Somente `POST /api/audit` exige `Authorization: Bearer <token Supabase>` validado em `/auth/v1/user`, ou `x-access-key` para modo individual configurado. Segredos nunca aparecem na configuração pública. Com conta, `consume_api_quota()` reserva uso de forma atômica no Postgres. Operações custosas têm limite de concorrência por instância. Pedidos inválidos também podem consumir quota, por segurança.

Erros: `{state,code,message}`. Status: 400 entrada/URL; 401 sessão; 403 domínio sem autorização; 404 recurso; 405 método; 413 tamanho; 422 análise inconclusiva; 429 limite/concorrência; 502 fonte/resposta; 503 fonte/acesso/quota não configurados ou indisponíveis; 504 timeout. Estados públicos: `not_configured`, `available`, `invalid_credential`, `limit`, `unavailable`, `partial`. Mensagens externas cruas/chaves não são devolvidas.

Não há POST HTTP fictício para IA ou score. Estes contratos são funções reais locais:

| Função | Entrada → saída |
|---|---|
| `evaluateOpportunity(business,settings,now?)` | dados disponíveis e evidências → `{score,priority,confidence,confidenceLabel,coverage,parts,reasons,offer,nextAction,preliminary,probability:null}`; avaliação inicial automática, sem chamadas externas |
| `ensureReadyPrompt(business,settings)` | prepara/atualiza uma versão automática em `business.prompts`, idempotente por dados, versão e permissões; retorna prompt pronto ou `null` sem fonte exportável |
| `calculateScore(business,settings,now?)` | negócio + regras → `{score,coverage,priority,eligible,parts,pending,reasons,version,weights,thresholds,at}` |
| `generateBriefing(business,settings,options)` | dados exportáveis + objetivo/estilo/páginas/funcionalidades → texto integral, 14 seções, uso interno |
| `generateForAI(business,settings,options)` | interseção de dados permitidos para IA e exportação → texto integral; não executa um modelo |
| `whatsappURL(business,message)` | WhatsApp confirmado ou explicitamente publicado com país/DDD → URL `wa.me` codificada, ou `null`; sem mutação de etapa |
| `projectBusiness(business,action)` | campos/avaliações/históricos permitidos para ação → documento filtrado |

## Documento Business

`{id,demo,segment,fields,sources,assessments,audits,scoreHistory,prompts,events,stage,favorite,notes,nextAction,createdAt,updatedAt,lifecycle}`.

Campo/critério: `{value,status,sourceId,observedAt,verifiedAt,expiresAt?,permissions?,reason?,confirmed?}`. Estados: verified (a fonte publicou), user (registro do usuário), inference (hipótese), missing e conflict. Fonte: `{id,label,url,collectedAt,expiresAt?,license?,permissions:{retain,export,ai}}`. Direito indefinido é negado. A permisssão de um item pode restringir adicionalmente a fonte; nunca ampliá-la.

A operação de retenção ocorre antes de gravar. Sem permissão para o nome, não há registro persistível. Prompts e snapshots são derivados de dados autorizados; sua validade acompanha as fontes. Notas comerciais e eventos são do próprio usuário e não são exportados no CSV de leads.

## Interface substituível de provedor

`search(input)`, `details(id)`, normalização e registro de evidências por campo. BusinessProvider implementa o contrato, priorizando OvertureProvider; PhotonProvider e OSMProvider são contingências. Adicionar outro fornecedor exige conferir licença, campos, cobertura, limites, retenção/exportação/IA e testes com transporte substituído antes da ativação. Não retornar dados fictícios em falhas. Google Places não é fallback.

## Persistência Auth/Data API

Auth: `/auth/v1/signup`, `/auth/v1/token?grant_type=password`, `/auth/v1/token?grant_type=refresh_token`, `/auth/v1/logout`. Data API: `profiles`, `businesses`; `apikey` publicável e JWT do usuário. RLS filtra `auth.uid()=user_id` em cada operação; a chave não é autorização para acessar outra conta. Cliente nunca define permissões pela `user_metadata`.

CSV de entrada: cabeçalho `name` obrigatório; demais campos do modelo são opcionais. UTF-8, 1 MB, 200 linhas, aspas escapadas e quebras internas suportadas. Prévia e confirmação antes de gravar; possíveis duplicatas são separadas para revisão, sem fusão automática. CSV de saída usa aspas, BOM e proteção contra fórmulas; é uma exportação filtrada, não um backup completo do CRM.

Auditoria: `authorized:true` continua obrigatório. Sem uma allowlist personalizada, somente o domínio informado e sua variante www são autorizados nessa operação, preservando a validação HTTPS/DNS/IP. `AUDIT_MODE=disabled` desativa a função.

Sessão: tokens são mantidos em sessionStorage por projeto para restaurar a mesma aba; renovação concorrente é agregada. Busca salva registros em uma única requisição REST de upsert. Cache por instância: dez minutos, com horário original da coleta; até 24 amostras Photon e 12 consultas Overpass. A busca prioriza Overture com prazo total de 13 segundos; em falhas transitórias, Photon recebe dois segundos e Overpass, uma tentativa de 1,5 segundo. A localização municipal Photon é guardada por 24 horas; cidade/UF são validadas pelo catálogo local IBGE antes de qualquer chamada. Homônimos e registros de outras cidades/estados/países são descartados. Cache antigo de até 12 h só é retornado com `cache:stale`, `state:partial` e aviso. `remark` de timeout sem elementos dispara recuperação, em vez de ser convertido em zero resultados. O servidor saudável passa a receber prioridade e os indisponíveis entram em pausa de 60 s (30 s para 429).

Busca e detalhes não consultam Auth nem reservam quota por conta; uma sessão expirada ou o banco indisponível não bloqueiam essas rotas. O limite público é de 30 operações/hora/IP/instância, com intervalo de três segundos. Cabeçalhos de IP enviados pelo visitante são ignorados fora da Vercel. Visitantes salvam resultados no armazenamento local; sincronização em conta é opcional. As políticas RLS do banco permanecem inalteradas.

O frontend usa GET canônico, cache de até oito pesquisas e cancelamento por AbortController, com prazo de 18 s independente do transporte. Respostas de erro e respostas canceladas não entram no cache. A resposta bem-sucedida inclui `collectedAt` e `cache` (`miss`, `fresh` ou `stale`); cabeçalhos de cache da CDN não são habilitados para erros, auditorias, preferências ou notas.

Catálogo da interface: `GET /data/cities/{UF}.json`, com UF oficial em maiúsculas, retorna `[{id:number,name:string}]`. São arquivos estáticos do mesmo site, com nomes oficiais acentuados e códigos IBGE. Não requer login nem chamada externa. Trocar a UF limpa a seleção; a cidade é validada no catálogo carregado antes da pesquisa.

## Prompt pronto e armazenamento

A preparação é local: `readLocal`, `persist`, `persistBatch`, carga da conta e abertura da ficha preparam os prompts automaticamente. A resposta HTTP da busca continua leve, com os dados de origem; nenhum prompt é solicitado a um modelo externo. O prompt pronto usa 15 perfis de segmento, dados específicos e 14 seções. A versão automática contém `automatic:true`, `generatorVersion`, `inputKey`, `destination`, `sourceIds`, `expiresAt` e permissões. Campos excluídos por validade, conflito ou licença não retornam por meio da geração automática. A validade acompanha a menor validade de campo/fonte utilizado.

Somente versões manuais precisam persistir seu texto. O serializador omite a versão automática derivada; ela é reconstruída dos dados ao carregar localmente ou na conta. Isso evita duplicar cerca de 13 KB de texto por comércio no armazenamento ou tráfego. Edições são versões com `automatic:false`, preservadas nas gravações. Recalcular não sobrescreve evidências nem snapshots da regra anterior.

## Catálogo com contatos

`OvertureProvider` lê Places PMTiles da release `2026-09-23.1`, com cache de até oito recortes por uma hora. O transporte exige HTTP 206 e content-range correspondente, limite de oito MB por leitura e prazo de seis segundos por requisição. A operação principal inteira tem prazo de 13 s; contingências de 2 s e 1,5 s. Nenhuma URL arbitrária é recebida do cliente para ler arquivos remotos.

IDs `overture-UUID` preservam os contatos e as fontes do mesmo registro, sem juntar empresas apenas pelo nome. Os campos incluem permissões/licença e `providerMeta` registra categoria, release, confiança da fonte e atualização. A confiança da fonte não é probabilidade de fechamento. O frontend recebe somente resultados normalizados, sem o arquivo mundial.

O GET de busca do frontend inclui `v=3` para invalidar consultas CDN da versão que não trazia contatos. Mesma unidade pode receber preenchimento automático de campos ausentes; dados preenchidos não são sobrescritos. Pontuação pode ser `null` quando a base é insuficiente. Telefone, mailto, site e redes são links diretos validados. Um WhatsApp explicitamente publicado recebe `published:true`, mantendo `confirmed` separado; telefone isolado não vira WhatsApp.

## Abordagem pronta por comércio

`approach(business,settings,now?)` monta localmente uma proposta curta por nome, cidade, segmento, serviços exportáveis e presença digital; não afirma inspeção, interesse nem resultados de venda. Vendedor/agência vêm das configurações existentes. `whatsappDraft(business,settings,{message?,now?})` retorna `{url,message,number,confirmed,published,requiresCheck}` ou `null`. O texto editado substitui integralmente o rascunho e é codificado em `text` no link oficial `https://wa.me/NUMERO`.

O destino prioriza o campo WhatsApp com número internacional válido; aceita links wa.me e api/web.whatsapp.com/send. Em seguida, pode usar o telefone comercial completo, sem adivinhar país, DDD ou dígitos. Essa alternativa exibe **WhatsApp a confirmar**, sem preencher o campo WhatsApp, mudar a pontuação, registrar confirmação ou alterar a negociação. O contato pode não ter conta WhatsApp; a verificação ocorre no aplicativo antes do envio manual.

Demonstração, Não contatar, unidade encerrada/duplicada/fora de escopo, fonte expirada, campo conflitante ou falta de direitos de retenção/exportação não produzem link acionável. O navegador apenas abre uma conversa para revisão. Nenhuma chamada à API de envio ou envio automático é executado.
