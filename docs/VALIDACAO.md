# Validação da configuração automática

Manutenção em 19/10/2026. Runtime: Node.js 24.19.0.

## Código e fluxos automatizados

`npm run build` executa verificação de sintaxe/ativos e a suíte Node. A suíte contém **59 testes**, incluindo:

- Configuração sem `.env.local`, projeto Supabase conectado, substituições opcionais sem misturar chaves de projetos diferentes e ausência de segredos na resposta pública.
- Busca/detalhes públicos sem chamadas a Auth/REST, inclusive com token inválido; limite por visitante/instância, intervalo entre chamadas e proteção contra cabeçalho de IP forjado fora da Vercel. Auditoria mantém autenticação pelo contrato `/auth/v1/user` e reserva de quota. Nestes testes de contrato, o transporte externo é substituído por fixtures.
- Busca municipal por código IBGE, normalização de caixa/acentos, homônimos em UFs diferentes, rejeição imediata de cidade/segmento inválido e área do Distrito Federal. Prazo independente do transporte (inclusive fetch que ignora cancelamento e corpo travado), recuperação de timeout JSON vazio, respeito a 429, preferência pela fonte saudável, pausa de fontes indisponíveis e cache com data original.
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
| OpenStreetMap ao vivo | Nominatim e a API oficial de relação responderam: Itapeva/SP foi localizado e seu código OSM/IBGE confirmado. Os servidores Overpass continuaram indisponíveis neste ambiente: principal retornou 406 e alternativa não respondeu dentro do prazo. O teste da consulta otimizada encerrou em cerca de 14 s (limite das duas tentativas). Nenhuma lista de comércios ao vivo foi validada ou inventada |
| Auditoria de empresa real | Não executada; contratos e proteções testados com fixtures |
| Navegador visual | A instalação Chromium do ambiente falhou no download do binário. Fluxos foram verificados em DOM; layout, clipboard e download em navegador real continuam sem validação visual nesta manutenção |
| Windows | `iniciar.bat` preparado, mas não executado neste ambiente Linux |
| Vercel | Integração Git existente identificada por status de deploy anterior; o plugin recusou acesso ao projeto com HTTP 403. Não foi possível administrar ou confirmar a hospedagem por esse plugin |
| IA generativa/PageSpeed | IA externa não implementada; briefing local funcional. PageSpeed opcional sem chave permanece não medido |

O build do Vercel foi configurado para executar os testes antes da publicação. A integração Git existente poderá publicar o commit sem copiar configurações, conforme as permissões e o estado do provedor. Não há garantia de 100% de disponibilidade de serviços externos.

## Regressões de lentidão e não conclusão

Os novos testes simulam servidores sem resposta, corpo de resposta que nunca termina, resposta parcial, timeout dentro de JSON HTTP 200, cache vencido, ambas as fontes fora do ar e cancelamento. São fixtures determinísticas; não são medições de desempenho do provedor real.

O navegador usa cache local da pesquisa sem repetir HTTP, preserva cópias independentes dos objetos, impõe prazo de 18 s e distingue cancelamento de falha. GET público bem-sucedido emite a política de cache da CDN; entrada inválida e operações privadas mantêm no-store. Não foi possível verificar HIT/STALE da CDN publicada ou logs de produção por causa do bloqueio 403 do plugin Vercel.
