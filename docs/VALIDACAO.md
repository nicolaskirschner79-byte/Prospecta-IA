# Validação da configuração automática

Manutenção em 19/10/2026. Runtime: Node.js 24.19.0.

## Código e fluxos automatizados

`npm run build` executa verificação de sintaxe/ativos e a suíte Node. A suíte contém **70 testes**, incluindo:

- Configuração sem `.env.local`, projeto Supabase conectado, substituições opcionais sem misturar chaves de projetos diferentes e ausência de segredos na resposta pública.
- Busca/detalhes públicos sem chamadas a Auth/REST, inclusive com token inválido; limite por visitante/instância, intervalo entre chamadas e proteção contra cabeçalho de IP forjado fora da Vercel. Auditoria mantém autenticação pelo contrato `/auth/v1/user` e reserva de quota. Nestes testes de contrato, o transporte externo é substituído por fixtures.
- Busca municipal por código IBGE, normalização de caixa/acentos, homônimos em UFs diferentes, rejeição imediata de cidade/segmento inválido e área do Distrito Federal. Prazo independente do transporte (inclusive fetch que ignora cancelamento e corpo travado), recuperação de timeout JSON vazio, respeito a 429, preferência pela fonte saudável, pausa de fontes indisponíveis e cache com data original.
- Catálogo com os 5.571 nomes/IDs correspondentes ao índice oficial, 27 estados, filtro sem acentos, escolha pelo teclado, limpeza ao mudar UF e proteção contra resposta atrasada de outro estado. HTTP local entrega os catálogos como JSON.
- Photon: homônimos, ordem do bbox, categorias em OR, rejeição de outro município/UF/país, contatos ausentes, cache, chamadas concorrentes, corpo/fetch travados, prazo total e recuperação por Overpass. HTTP 429 é respeitado sem troca de fornecedor.
- Sessão preservada no reload da mesma aba, renovação única em chamadas concorrentes, gravação de resultados em lote e saída local mesmo quando o serviço está indisponível.
- Interface em DOM LinkeDOM: busca direta, sem cadastro → API HTTP compartilhada → normalização OSM → gravação local → resultado na tela → registros preservados ao recarregar. Chamadas inesperadas a Auth/REST falham neste fluxo; apenas a fonte usa transporte de teste. Cancelar uma consulta travada libera o formulário e preserva a base visível.
- Demonstração separada, filtro, ficha, briefing de 14 seções, versões, favoritos e preservação do filtro ao voltar.
- Direitos/validade por campo/fonte, CSV seguro, WhatsApp confirmado, pontuação determinística, cobertura desconhecida e exclusão de registros suprimidos do ranking.
- Auditoria restrita à operação e proteção SSRF, incluindo esquemas, portas, IPs privados/reservados/metadados e DNS misturado. Testes da auditoria usam páginas de teste, sem afirmar inspeção de empresa real.
- Schema, políticas e função de quota executados em Postgres PGlite, com duas identidades e tentativas de leitura/alteração entre contas.

## Verificado no Supabase conectado

Projeto: `aotlmtaqgyxojssjxubm` / **Prospecta IA**.

1. O projeto estava ativo e o schema público, vazio. Foi aplicada a migração `prospecta_initial_schema`, correspondente ao schema do repositório.
2. `supabase/tests/rls.sql` foi executado no projeto, dentro de uma transação revertida: criação/leitura pelo proprietário, isolamento entre duas identidades, bloqueio de reassociação/alteração/inserção/exclusão por outra conta, proteção da tabela de quota e bloqueio anônimo.
3. Consulta posterior confirmou RLS ativo em `profiles`, `businesses` e `api_usage`; zero fichas, perfis, contadores e usuários de teste restantes.
4. `/auth/v1/settings` respondeu com e-mail habilitado, cadastro permitido e confirmação por e-mail obrigatória.
5. A API REST real recusou leitura anônima de `businesses` com HTTP 401, sem conceder acesso usando somente a chave publicável.
6. Security Advisor: nenhum alerta ERROR/WARN retornado. Um INFO esperado indica RLS sem políticas em `api_usage`; a tabela é intencionalmente inacessível ao usuário, com alteração somente pela função privada de quota.

Nenhum e-mail de teste foi enviado, nenhuma conta pessoal foi criada e nenhuma senha ou chave secreta foi coletada. Confirmação de e-mail/entrega SMTP não foi testada de ponta a ponta.

## Limites desta verificação

| Camada | Evidência e limite |
|---|---|
| API/DOM e regras | Testes automatizados com fixtures externas; não equivalem à disponibilidade contínua de fornecedores |
| Supabase real | Schema, RLS, quotas, Auth settings e bloqueio REST anônimo verificados; login de uma pessoa e entrega de confirmação não exercitados |
| OpenStreetMap ao vivo | O provedor Photon implementado retornou 50 registros de Itapeva/SP em cerca de 4,5 s, com conferência de cidade/UF e dados ausentes preservados. O teste usou o transporte Node real com o proxy do ambiente. Um segundo teste percorreu interface DOM → HTTP local → Photon real → resposta → gravação local: 50 registros retornados e salvos em cerca de 5,7 s, com oito cartões na primeira página. A troca SP → MG → SP e o filtro de cidades também foram exercitados usando os arquivos HTTP reais. Essas medições isoladas não garantem tempo constante nem validam a identidade de cada registro colaborativo. Overpass permaneceu instável e agora é contingência |
| Auditoria de empresa real | Não executada; contratos e proteções testados com fixtures |
| Navegador visual | A instalação Chromium do ambiente falhou no download do binário. Fluxos foram verificados em DOM; layout, clipboard e download em navegador real continuam sem validação visual nesta manutenção |
| Windows | `iniciar.bat` preparado, mas não executado neste ambiente Linux |
| Vercel | Integração Git existente identificada por status de deploy anterior; o plugin recusou acesso ao projeto com HTTP 403. Não foi possível administrar a hospedagem por esse plugin. A conclusão de publicação é verificada pelo status Vercel no commit GitHub |
| IA generativa/PageSpeed | IA externa não implementada; briefing local funcional. PageSpeed opcional sem chave permanece não medido |

O build do Vercel foi configurado para executar os testes antes da publicação. A integração Git existente publica os commits sem copiar configurações; a conclusão é conferida no status do commit. Não há garantia de 100% de disponibilidade de serviços externos.

## Regressões de lentidão e não conclusão

Os novos testes simulam servidores sem resposta, corpo de resposta que nunca termina, resposta parcial, timeout dentro de JSON HTTP 200, cache vencido, ambas as fontes fora do ar e cancelamento. São fixtures determinísticas; não são medições de desempenho do provedor real.

O navegador usa cache local da pesquisa sem repetir HTTP, preserva cópias independentes dos objetos, impõe prazo de 18 s e distingue cancelamento de falha. GET público bem-sucedido emite a política de cache da CDN; entrada inválida e operações privadas mantêm no-store. Não foi possível verificar HIT/STALE da CDN publicada ou logs de produção por causa do bloqueio 403 do plugin Vercel.
