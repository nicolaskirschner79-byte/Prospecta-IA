# Contratos do MVP

Respostas JSON, UTF-8, `Cache-Control: no-store`. Backend local e serverless compartilham `handleAPI`. Sem CORS público. Na aplicação use mesma origem.

## HTTP

| Operação | Contrato |
|---|---|
| `GET /api/config` | público; `{search, audit, ai:'template', access, supabase:{url,key}|null}`. Somente URL/chave **publicável** Supabase; nunca acesso privado/PageSpeed/segredos |
| `POST /api/search` | `{city:string,uf:string,query?:string,district?:string,segments?:string[]}`; resposta `{state,businesses:Business[],nextCursor:null,partial:true,notice,attribution,licenseURL}` |
| `POST /api/details` | `{id:'osm-node-123'}` (ou way/relation); `{business:Business,state}`. Interface revisa diferenças em vez de sobrescrever |
| `POST /api/audit` | `{url:'https://dominio-autorizado',authorized:true}`; `{id,at,expiresAt,url,tests,performance,permissions,limits,state:'partial'}` |

Operações POST exigem `Authorization: Bearer <token Supabase>` validado em `/auth/v1/user`, ou `x-access-key` para modo individual configurado. Segredos nunca aparecem na configuração pública. Com conta, `consume_api_quota()` reserva uso de forma atômica no Postgres. Operações custosas têm limite de concorrência por instância. Pedidos inválidos também podem consumir quota, por segurança.

Erros: `{state,code,message}`. Status: 400 entrada/URL; 401 sessão; 403 domínio sem autorização; 404 recurso; 405 método; 413 tamanho; 422 análise inconclusiva; 429 limite/concorrência; 502 fonte/resposta; 503 fonte/acesso/quota não configurados ou indisponíveis; 504 timeout. Estados públicos: `not_configured`, `available`, `invalid_credential`, `limit`, `unavailable`, `partial`. Mensagens externas cruas/chaves não são devolvidas.

Não há POST HTTP fictício para IA ou score. Estes contratos são funções reais locais:

| Função | Entrada → saída |
|---|---|
| `calculateScore(business,settings,now?)` | negócio + regras → `{score,coverage,priority,eligible,parts,pending,reasons,version,weights,thresholds,at}` |
| `generateBriefing(business,settings,options)` | dados exportáveis + objetivo/estilo/páginas/funcionalidades → texto integral, 14 seções, uso interno |
| `generateForAI(business,settings,options)` | interseção de dados permitidos para IA e exportação → texto integral; não executa um modelo |
| `whatsappURL(business,message)` | WhatsApp confirmado com país/DDD → URL `wa.me` codificada, ou `null`; sem mutação de etapa |
| `projectBusiness(business,action)` | campos/avaliações/históricos permitidos para ação → documento filtrado |

## Documento Business

`{id,demo,segment,fields,sources,assessments,audits,scoreHistory,prompts,events,stage,favorite,notes,nextAction,createdAt,updatedAt,lifecycle}`.

Campo/critério: `{value,status,sourceId,observedAt,verifiedAt,expiresAt?,permissions?,reason?,confirmed?}`. Estados: verified (a fonte publicou), user (registro do usuário), inference (hipótese), missing e conflict. Fonte: `{id,label,url,collectedAt,expiresAt?,license?,permissions:{retain,export,ai}}`. Direito indefinido é negado. A permisssão de um item pode restringir adicionalmente a fonte; nunca ampliá-la.

A operação de retenção ocorre antes de gravar. Sem permissão para o nome, não há registro persistível. Prompts e snapshots são derivados de dados autorizados; sua validade acompanha as fontes. Notas comerciais e eventos são do próprio usuário e não são exportados no CSV de leads.

## Interface substituível de provedor

`search(input)`, `details(id)`, normalização e registro de evidências por campo. OSMProvider implementa o contrato. Adicionar outro fornecedor exige conferir licença, campos, cobertura, limites, retenção/exportação/IA e testes com transporte substituído antes da ativação. Não retornar dados fictícios em falhas. Google Places não é fallback.

## Persistência Auth/Data API

Auth: `/auth/v1/signup`, `/auth/v1/token?grant_type=password`, `/auth/v1/token?grant_type=refresh_token`, `/auth/v1/logout`. Data API: `profiles`, `businesses`; `apikey` publicável e JWT do usuário. RLS filtra `auth.uid()=user_id` em cada operação; a chave não é autorização para acessar outra conta. Cliente nunca define permissões pela `user_metadata`.

CSV de entrada: cabeçalho `name` obrigatório; demais campos do modelo são opcionais. UTF-8, 1 MB, 200 linhas, aspas escapadas e quebras internas suportadas. Prévia e confirmação antes de gravar; possíveis duplicatas são separadas para revisão, sem fusão automática. CSV de saída usa aspas, BOM e proteção contra fórmulas; é uma exportação filtrada, não um backup completo do CRM.
