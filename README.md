# Prospecta IA

Prospecção de comércios para criação de sites: busca → ficha com fontes → avaliação da oportunidade → briefing → contato revisado → negociação.

## Pronto para esta instalação

O projeto **Prospecta IA** no Supabase já está conectado pelo código. As tabelas, políticas de isolamento entre contas e função de quota foram instaladas e verificadas no banco. A busca OpenStreetMap já vem ativada e identificada com o endereço deste repositório. **Não é necessário criar `.env.local`, copiar chaves ou executar SQL para usar esta instalação.**

1. Abra o site e clique em **Buscar comércios** ou na conta do menu.
2. Crie sua conta, confirme o e-mail se solicitado e entre. Isso protege seus registros; não é configuração técnica. Após confirmar, volte ao site e faça login.
3. Informe cidade/UF e, se desejar, segmento, palavra-chave e bairro. A busca pendente continua após entrar. Os novos resultados são salvos na sua conta automaticamente, em um único lote.
4. Abra a ficha, confirme a identidade e registre as evidências. A pontuação depende do que foi verificado, sem inventar probabilidade de compra.
5. Gere o briefing completo em **Prompt do site**. Contatos e mensagens exigem revisão; WhatsApp só é ativado para um número confirmado com país e DDD.

O gerador funciona por **template local de 14 seções**, sem API paga ou configuração de IA. Ele não executa um modelo generativo. O conteúdo pode ser copiado ou baixado para outra ferramenta, conforme as permissões da fonte.

Cadastro/importação/briefings também funcionam no espaço local sem login. Dados locais ficam neste navegador; dados da conta ficam no Supabase com RLS por usuário. Essas bases não são misturadas automaticamente. A demonstração é fictícia e separada, somente em memória.

## Executar no computador

Com **Node.js 24 LTS** instalado:

```bash
npm start
```

Abra `http://localhost:3000`. No Windows, também pode abrir `iniciar.bat`. O runtime usa APIs nativas do Node, sem instalar pacotes nem configurar banco. Não abra `index.html` diretamente por `file://`.

Para desenvolver/verificar:

```bash
npm ci
npm run build
```

`npm run build` verifica sintaxe/ativos e executa todos os testes. As dependências de desenvolvimento são usadas apenas nos testes.

## Busca e disponibilidade

- Fonte: OpenStreetMap, consultado pelo Overpass. Servidor principal `https://overpass-api.de/api/interpreter`; alternativa `https://overpass.private.coffee/api/interpreter` somente em falha transitória. Um HTTP 429 é respeitado, sem trocar de servidor para contornar a quota.
- Cache de cinco minutos por instância, com limite de 12 consultas e agregação de chamadas simultâneas iguais. Cache preserva o horário da consulta original.
- Cidade aceita diferenças de maiúsculas/acentos; Distrito Federal usa a área administrativa estadual. Nomes alternativos e áreas ausentes ainda podem produzir resultado vazio.
- Até 100 objetos da fonte, 50 resultados exibidos por consulta; palavra-chave/bairro filtram essa amostra. Não representa todos os comércios da região e não oferece paginação externa.
- A falta de website no cadastro não comprova ausência de site. Telefones não viram WhatsApp automaticamente. Falhas externas nunca são substituídas por comércios inventados.
- Atribuição **© OpenStreetMap contributors**, licença ODbL e fontes são preservadas nas exportações. Consulte [fontes e permissões](docs/FONTES.md).

## Conta e sincronização

A sessão é renovada automaticamente e preservada em `sessionStorage` ao recarregar a mesma aba. Sair da conta limpa a sessão local mesmo se o serviço estiver indisponível. O aplicativo não guarda tokens em `localStorage`. Fechar a sessão da aba pode exigir novo login.

`profiles` guarda preferências, `businesses` guarda cada ficha/histórico atomicamente em JSONB e `api_usage` controla quotas. Registros de outra conta não podem ser lidos ou alterados. A chave `sb_publishable_...` do código é pública por definição; acesso a registros depende do JWT do usuário e das políticas RLS, nunca dessa chave isolada. Não há chave secreta ou `service_role` no projeto.

Limites: 500 KB por ficha, 1.000 registros carregados por conta, 30 consultas externas/hora/conta e três segundos entre chamadas. Colaboração simultânea na mesma ficha usa a última gravação; resolução de conflitos entre abas está fora desta versão.

## Auditoria de site

Na ficha, confirme identidade/vínculo do site e a autorização para analisá-lo. O servidor autoriza o domínio e sua variante `www` apenas para essa operação; não é preciso editar variáveis por comércio. Redirecionamento para outro domínio exige revisão.

A auditoria lê uma página e `robots.txt`, com limites de tempo/bytes. DNS é validado antes de cada conexão e fixado no acesso; IPs privados, localhost, metadados, portas e esquemas inseguros são bloqueados. Restrições em robots e bloqueios da página produzem resultado inconclusivo.

Não há inspeção visual, execução de JavaScript ou teste real de formulários. Lighthouse/PageSpeed é uma medição **opcional** que só ocorre com `PAGESPEED_API_KEY`; sem ela, a auditoria básica continua funcional e desempenho aparece como não medido.

## Publicação automática

O repositório já possui integração Git com o projeto Vercel `prospecta-ia`. `vercel.json` define instalação, build com testes, saída `public`, região `gru1` e limite de 60 segundos para a API. Novos commits na branch de produção são enviados pela integração existente; o build falha se as verificações falharem.

Nesta manutenção, o plugin Vercel recusou acesso à conta do projeto com **403**. O código está preparado para a integração existente, mas isso impede administrar a hospedagem ou confirmar sua configuração pelo plugin. Não confunda configuração do código com confirmação de uma publicação no ar; veja [validação](docs/VALIDACAO.md).

## Personalização técnica opcional

`.env.example` lista somente substituições opcionais. Para usar outro Supabase, informe **URL e chave publicável juntas**, instale `supabase/schema.sql` em um projeto vazio e configure Auth desse novo projeto. Não execute o schema inicial novamente no banco já instalado.

`ENABLE_OSM=false` desativa a busca; `AUDIT_MODE=disabled` desativa auditorias; `AUDIT_ALLOWED_HOSTS` restringe os domínios quando desejado. `DISABLE_CLOUD=true` com `APP_ACCESS_KEY` permite instalação individual sem Supabase, com limites por instância. Nunca envie senhas/tokens ao Git.

Fontes OSM têm validade de 30 dias; auditorias, sete dias. Retenção local segue preferências. Exclusão remota e revisão de registros vencidos são manuais. Não há disparo automático de mensagens, pagamentos, raspagem de Google Maps ou integração de IA generativa nesta versão.

[Contrato da API](docs/API.md) · [Pontuação](docs/PONTUACAO.md) · [Validação](docs/VALIDACAO.md)
