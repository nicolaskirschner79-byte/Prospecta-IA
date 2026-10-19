# Prospecta IA

Aplicação em português para organizar a prospecção de criação de sites: **cadastro/importação ou busca configurada → ficha → evidências → índice explicável → briefing → contato revisado → negociação**.

O gerador desta versão usa **template estruturado**, sem chamadas a IA generativa e sem chave OpenAI. O nome do produto não implica execução de um modelo. Não há disparos automáticos, pagamentos ou integração com Google Maps/Places.

## Executar

Requer Node.js **22.6 ou superior** (testado com 24.19). O servidor e o frontend não precisam de bibliotecas externas em produção.

```bash
npm ci
npm start
```

Abra `http://localhost:3000`. `npm ci` instala somente as ferramentas de teste do projeto; o runtime usa APIs nativas do Node. Não abra `index.html` via `file://`: módulos precisam de HTTP.

```bash
npm run check
npm test
```

## Primeiro uso, sem integrações

1. Em **Configurações**, preencha nome do vendedor/agência e portfólio, se desejar. Nenhuma marca é inventada.
2. **Cadastre um comércio** com dados autorizados ou **importe CSV** usando o modelo vazio disponível no painel. Marque apenas as permissões que a origem permite.
3. Abra a ficha e registre a identidade e as evidências de cada critério. Justificativas são obrigatórias. A ausência de website em um cadastro é inconclusiva.
4. Veja a pontuação e as verificações pendentes em **Oportunidade**.
5. Em **Prompt do site**, edite objetivo/estilo/funcionalidades e gere o briefing com 14 seções. A versão **Para IA** exige permissões de exportação e de envio a IA para os dados utilizados. A versão **Uso interno** não deve ser enviada a uma IA quando contiver dados restritos.
6. Revise a mensagem em **Contato e negociação**. WhatsApp só fica disponível com confirmação explícita, país e DDD. O clique não registra contato/venda; atualize a etapa manualmente.

O espaço local usa armazenamento deste navegador, em dispositivo compartilhado com quem usa esse mesmo perfil. Não é uma conta autenticada. Fechar/reabrir preserva os registros locais autorizados, favoritos, notas e prompts. A demonstração é separada e fica somente em memória; todos os negócios são fictícios e os contatos ficam desativados.

## Configurar as integrações

Copie `.env.example` para `.env.local` **somente na sua máquina**. O arquivo real é ignorado pelo Git. Use o painel de variáveis de ambiente do provedor de hospedagem para produção. Não envie senhas/chaves pelo chat nem coloque segredos no repositório.

### OpenStreetMap / Overpass (opcional)

```dotenv
ENABLE_OSM=true
PROVIDER_CONTACT=https://github.com/SEU_USUARIO/SEU_REPOSITORIO
APP_ACCESS_KEY=DEFINA_UM_CODIGO_PRIVADO_LONGO_NO_SEU_AMBIENTE
```

Depois de reiniciar o servidor, abra Configurações e informe o código de acesso **nesta sessão**. Ele só fica na memória da página. Em instalações com Supabase Auth configurado, prefira entrar na conta; a aplicação valida o usuário no servidor antes de consultar uma fonte.

Fonte efetivamente implementada: `https://overpass-api.de/api/interpreter`. A consulta usa uma área administrativa de município dentro da UF brasileira, tags de comércio e uma taxonomia de 15 segmentos. A consulta é exata para o nome do município no OpenStreetMap; nomes alternativos, áreas ausentes e Distrito Federal podem retornar vazio. Não há alegação de cobertura universal de empresas.

Há um limite de 100 objetos retornados na consulta e 50 resultados após filtros. Palavra-chave/bairro filtram essa amostra; uma resposta vazia **não** comprova ausência de comércios ou de sites. A API não fornece cursor de paginação nesta implementação. A paginação de oito cards é **local**. Não há filtro de raio fictício.

Dados colaborativos podem estar incompletos ou desatualizados. Não se presume identidade, domínio próprio, atividade atual ou WhatsApp. Resultados do fornecedor não sobrescrevem correções do usuário; divergências ficam registradas como conflitos.

Obrigatório manter **© OpenStreetMap contributors**, o link da licença e cumprir a ODbL. Os dados da fonte são tratados como um banco derivado sujeito às obrigações aplicáveis de atribuição e compartilhamento; não os relicencie como uma base proprietária irrestrita. CSV e briefings mantêm fontes/licença. Para distribuição ou uso comercial em escala, revise as obrigações da base concreta e hospede/contrate infraestrutura apropriada. A disponibilidade da instância pública não é um SLA nem uma promessa de consultas ilimitadas. Veja [fontes e permissões](docs/FONTES.md).

### Supabase: contas e sincronização (opcional)

1. Crie ou selecione um projeto Supabase vazio para esta aplicação.
2. Execute **uma vez** `supabase/schema.sql` no SQL Editor. O script não é uma migração idempotente para um banco com tabelas de mesmo nome. Examine-o antes de aplicá-lo a um projeto existente.
3. Configure no servidor `SUPABASE_URL=https://SEU_REF.supabase.co` e `SUPABASE_PUBLISHABLE_KEY` com a **chave publicável**, nunca `service_role`/chave secreta.
4. Habilite autenticação por e-mail/senha e configure confirmação por e-mail, redirecionamentos e SMTP conforme seu projeto. Abra o aplicativo → conta → criar conta → confirmar e-mail se necessário → entrar.
5. Em conta, os registros vêm do banco; a base local não é misturada nem enviada automaticamente. Cada conta tem perfil e negócios próprios, com RLS e grants explícitos. Para transportar registros locais, exporte somente os autorizados e importe-os na conta.
6. Em um banco **de teste**, execute `supabase/tests/rls.sql` para conferir duas identidades e acesso anônimo. A suite `npm test` também executa esse SQL em Postgres PGlite com o contrato `auth.uid()` simulado; isso não substitui a validação no projeto Supabase real.

Entidades `evidence`, auditorias, snapshots, prompts e eventos ficam dentro do documento `businesses.data`, com atualização atômica por negócio. `profiles` guarda preferências; `api_usage` guarda quotas. Isso evita notas compartilhadas entre contas e não retém respostas brutas indiscriminadamente. Há limite de 500 KB por negócio e 1.000 registros carregados por conta nesta versão. Não edite simultaneamente o mesmo registro em duas abas: a última gravação vence; colaboração concorrente está fora do MVP.

Tokens Auth ficam em memória, com renovação quando necessário; recarregar exige novo login. O cliente não usa metadata editável para autorizar ações. CSP permite conexões a subdomínios `supabase.co`; se usar domínio personalizado, ajuste conscientemente a política nos dois servidores.

### Auditoria autorizada e PageSpeed (opcionais)

```dotenv
AUDIT_ALLOWED_HOSTS=dominio-autorizado.com.br,www.dominio-autorizado.com.br
PAGESPEED_API_KEY=
```

Confirme a identidade e o vínculo do domínio na ficha antes de executar. Cada host de redirecionamento precisa estar na lista. Somente HTTPS, porta padrão e HTML/texto limitado são aceitos. DNS e IP são validados e fixados na conexão; URLs internas/metadados são bloqueadas. `robots.txt` com qualquer `Disallow` não vazio exige revisão humana (política conservadora). A autorização declarada e a allowlist são requisitos adicionais, não substitutos de licenças/termos da página.

A auditoria lê **uma página e robots.txt**; não executa JavaScript, não faz inspeção visual/mobile real, não testa formulários e não percorre links. Presença de meta viewport é um teste de HTML, não uma certificação de responsividade. Contato não detectado e clareza de CTA ficam desconhecidos, sem penalidade artificial.

PageSpeed só é chamado se houver chave configurada, com estratégia mobile e registro da data. É uma medição de laboratório, sem promessa sobre todos os visitantes. A resposta de erro/limite não é transformada em nota. API e infraestrutura podem ter quotas/custos próprios.

## Implantação preparada para Vercel

O código contém `vercel.json` e `api/[route].js`, sem framework ou build de frontend. Na importação do repositório, use **Other**, saída `public` e build `npm run check`. Configure as variáveis no ambiente do projeto. As funções usam Node e não carregam PGlite/LinkeDOM em produção.

Esta entrega de código não cria um projeto de hospedagem ou uma URL pública automaticamente. A publicação do site é uma ação separada. O adaptador Vercel está preparado, mas não foi testado em uma implantação real.

## Segurança, limites e retenção

- Dados externos passam como texto escapado; não há HTML de fornecedor inserido com confiança, conteúdo executável de páginas ou instruções de terceiros executadas por IA.
- Campos e avaliações carregam origem, estado, datas, validade e permissões. Exportações removem campos restritos, vencidos/conflitantes. Prompts derivados têm validade limitada pelas fontes utilizadas; reveja edições manuais antes de compartilhar.
- Consultas externas autenticadas: 30 operações/hora/conta e intervalo de 3 segundos. Com Supabase, reserva transacional em banco por identidade; sem Supabase, código de acesso para um usuário e limite **por instância**. Instalações públicas com múltiplas instâncias devem usar Supabase; o contador em memória sozinho não é uma quota global.
- Concorrência local limitada a duas operações externas/instância; sem retentativa automática, evitando repetir custo/consulta. Timeout no cliente de 55 s; Overpass de 25 s; auditoria com teto total. Limite de corpo de requisição de 16 KB e de leitura da fonte de 1,5 MB.
- Fontes OpenStreetMap expiram para uso em 30 dias; auditorias em 7 dias; registros manuais/importados conforme retenção configurável. Em armazenamento local, dados sem atualização no prazo deixam de ser persistidos na próxima gravação. Na conta, exclusão remota é manual nesta versão: revisar periodicamente fontes/validade e excluir registros vencidos. O aplicativo não anuncia uma limpeza agendada inexistente.
- RLS isola contas; notas comerciais não são incluídas no CSV/briefing padrão. Exclusão do registro remove seu documento e histórico no espaço atual. “Não contatar” suprime abordagens e fica preservado no CRM. Se excluir um registro de supressão, futuras importações não poderão reconhecer essa preferência: preserve-o enquanto necessário para respeitar a solicitação.
- A sessão pode ser encerrada no aplicativo; não há API para apagar uma conta Auth. Para exclusão integral de conta, encerrar/revogar sessões e seguir o procedimento do administrador Supabase; não considerar apagar `auth.users` isoladamente como revogação de todos os tokens.

## Estrutura

```text
public/           HTML, CSS, interface e módulos puros
public/lib/       dados, score, permissões, briefing, contatos, storage/Auth
server/           servidor local, segurança, auditoria, handler HTTP
server/providers/ adaptador OpenStreetMap substituível
api/              entrada serverless
supabase/         schema, RLS, quota e testes SQL
tests/            domínio, integrações simuladas, HTTP, DOM e Postgres
docs/             contratos, rubrica, fontes e validação
```

Consulte [resultado dos testes e pendências](docs/VALIDACAO.md), [contratos](docs/API.md) e [rubrica](docs/PONTUACAO.md). Os testes não substituem validação visual em navegadores/dispositivos nem integrações autenticadas em produção.
