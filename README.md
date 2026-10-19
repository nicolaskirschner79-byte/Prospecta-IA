# Prospecta IA

Prospecção de comércios para criação de sites: busca → ficha com fontes → avaliação da oportunidade → briefing → contato revisado → negociação.

## Pronto para esta instalação

O projeto **Prospecta IA** no Supabase já está conectado pelo código. As tabelas, políticas de isolamento entre contas e função de quota foram instaladas e verificadas no banco. A busca em catálogos públicos já vem ativada e identificada com o endereço deste repositório. **Não é necessário criar `.env.local`, copiar chaves ou executar SQL para usar esta instalação.**

1. Abra o site, escolha o estado e selecione uma cidade no catálogo pesquisável. Se desejar, informe segmento, palavra-chave e bairro.
2. Clique em **Buscar comércios**. **Não é preciso cadastro, login ou código de acesso**, inclusive para atualizar os detalhes da fonte.
3. Os novos resultados são salvos automaticamente neste navegador. A conta é opcional para sincronização entre dispositivos; você pode entrar pelo menu quando desejar.
4. Cada cartão já mostra o potencial comercial de 0–100, a prioridade, os motivos e a confiança da avaliação. A análise inicial usa os dados publicados e hipóteses específicas do segmento; confirmar identidade e registrar evidências melhora a avaliação. A nota não é uma probabilidade estatística de compra.
5. Abra **Ver prompt pronto** para copiar ou baixar o prompt profissional completo, organizado em 14 seções e adaptado ao segmento, nome, localização e demais dados disponíveis. A personalização adicional é opcional. Nos cartões e na tabela, o botão **WhatsApp** abre a conversa com abordagem pronta para o comércio. Na ficha, o texto pode ser editado antes de abrir. Números publicados sem confirmação do canal são identificados como **a confirmar**; a abertura não envia a mensagem.

Os prompts são preparados automaticamente no navegador por **15 perfis de segmento e uma estrutura de 14 seções**, sem API paga ou configuração de IA. Incluem direção comercial, design e paleta propostos, arquitetura, copy, funcionalidades, ativos, acessibilidade, SEO local, requisitos técnicos e testes. A identidade visual só é descrita como observada quando há registro; dados ausentes são identificados para confirmação. O sistema não executa um modelo generativo. O conteúdo pode ser copiado ou baixado para outra ferramenta, conforme as permissões da fonte.

Cadastro/importação/briefings também funcionam no espaço local sem login. Dados locais ficam neste navegador; dados da conta ficam no Supabase com RLS por usuário. Essas bases não são misturadas automaticamente. A demonstração é fictícia e separada, somente em memória.

## Executar no computador

Com **Node.js 24 LTS** instalado:

```bash
npm start
```

Abra `http://localhost:3000`. No Windows, também pode abrir `iniciar.bat`. O início prepara automaticamente as dependências necessárias; a hospedagem instala tudo no deploy. Não é necessário configurar banco nem fornecer chave para as buscas. Não abra `index.html` diretamente por `file://`.

Para desenvolver/verificar:

```bash
npm ci
npm run build
```

`npm run build` verifica sintaxe/ativos e executa todos os testes. As dependências de desenvolvimento são usadas apenas nos testes.

## Busca e disponibilidade

- Fonte principal: **Overture Maps Places**, consultada por recortes PMTiles do catálogo público. A versão integrada é `2026-09-23.1`. O servidor lê somente pequenos intervalos de bytes; não baixa o arquivo mundial e não exige chave de API.
- A consulta usa o centro do município e uma amostra da área central; quando necessário, amplia para até quatro recortes adjacentes. Cidade, UF, país, categoria, licença e confiança mínima da origem são conferidos. Não representa todos os negócios da cidade.
- Telefones, e-mails, sites e redes são os publicados no registro. Links de ligação/e-mail/site ficam nos cartões. O botão WhatsApp prioriza o canal explícito e usa como alternativa o telefone completo publicado, com aviso **a confirmar**. Isso não registra o número como WhatsApp confirmado.
- Photon/OpenStreetMap e Overpass permanecem como contingência em falhas transitórias. HTTP 429 é respeitado, sem trocar de fonte para contornar o limite. Todas as operações possuem prazo e cancelamento.
- A consulta principal tem prazo total de 13 s; as contingências têm até 2 s e 1,5 s. O navegador encerra a espera em 18 s e oferece cancelar. Falhas preservam a base anterior.
- Catálogo local de cidades por estado com 5.571 nomes oficiais do IBGE, incluindo acentos. Digitar “sao” encontra “São”; mudar a UF limpa a cidade anterior.
- Recortes do catálogo são reutilizados por uma hora em até oito entradas por instância; geocodificação é guardada por 24 h. Cache de busca no navegador/CDN continua por dez minutos. Datas originais são preservadas.
- Até 50 resultados por consulta. Palavra-chave e bairro filtram a amostra; um bairro precisa estar publicado no endereço para ser filtrado. Não há paginação externa.
- Bases antigas compostas apenas pela amostra OSM sem contato, da mesma cidade selecionada, recebem uma tentativa automática de atualização por sessão. Atualizações preenchem campos ausentes somente quando a mesma unidade é identificada por ID, endereço ou proximidade com nome/cidade coincidentes; campos manuais preenchidos são preservados. Homônimos não são fundidos só pelo nome.
- A falta de website no cadastro não comprova ausência de site. Abrir o WhatsApp por telefone publicado não comprova que exista conta ou que o contato seja atual. Falhas externas nunca são substituídas por comércios inventados.
- Atribuição Overture Maps, fornecedores e licenças de cada registro são preservados; registros OSM mantêm **© OpenStreetMap contributors** e ODbL. Consulte [fontes e permissões](docs/FONTES.md).

## Avaliação e prompts automáticos

- Novas buscas, cadastros e importações já recebem um prompt pronto. Bases antigas são atualizadas em memória ao carregar, sem refazer a busca e sem envio de dados a um provedor de IA.
- `evaluateOpportunity` calcula potencial de venda e prioridade desde o primeiro cadastro. A versão 3 diferencia o modelo do site por segmento, presença digital, quantidade/tipo de contatos e dados específicos disponíveis. Apenas nome/cidade não recebem mais uma nota genérica: exibem “Dados insuficientes”. Mesmos dados podem ter a mesma nota; não há variação aleatória por nome. As hipóteses por segmento são identificadas; contato, interesse e presença digital confirmados prevalecem sobre sugestões. A confiança inicial é baixa quando faltam verificações. Negócios encerrados, perdidos ou suprimidos ficam fora da prospecção ativa.
- A nota de evidências `calculateScore` e os snapshots anteriores permanecem disponíveis. Nenhuma regra inventa orçamento ou disposição de compra; a ausência de site na amostra não comprova ausência de site real.
- O prompt automático acompanha mudanças nos dados e nas permissões sem acumular cópias. Edições e versões manuais são preservadas. O texto derivado é reconstruído dos dados ao carregar, evitando multiplicar armazenamento e tráfego por comércio; edições manuais são salvas normalmente.
- A versão padrão para IA inclui apenas os campos com retenção, exportação e IA permitidas. Se o nome só permitir exportação, o prompt fica identificado para uso interno. Sem fonte exportável vigente, não é criado um prompt exportável.

## Conta e sincronização

A sessão é renovada automaticamente e preservada em `sessionStorage` ao recarregar a mesma aba. Sair da conta limpa a sessão local mesmo se o serviço estiver indisponível. O aplicativo não guarda tokens em `localStorage`. Fechar a sessão da aba pode exigir novo login.

`profiles` guarda preferências, `businesses` guarda cada ficha/histórico atomicamente em JSONB e `api_usage` controla quotas. Registros de outra conta não podem ser lidos ou alterados. A chave `sb_publishable_...` do código é pública por definição; acesso a registros depende do JWT do usuário e das políticas RLS, nunca dessa chave isolada. Não há chave secreta ou `service_role` no projeto.

Limites: 500 KB por ficha, 1.000 registros carregados por conta, 30 buscas/consultas de detalhes por hora por IP e instância, com três segundos entre chamadas. O IP é resumido por hash em memória; na Vercel, o identificador vem do cabeçalho sobrescrito pela plataforma, e no servidor local vem da conexão real. Auditorias continuam autenticadas, com quota persistente de 30 operações/hora/conta. Colaboração simultânea na mesma ficha usa a última gravação; resolução de conflitos entre abas está fora desta versão.

## Auditoria de site

Na ficha, confirme identidade/vínculo do site e a autorização para analisá-lo. O servidor autoriza o domínio e sua variante `www` apenas para essa operação; não é preciso editar variáveis por comércio. Redirecionamento para outro domínio exige revisão.

A auditoria lê uma página e `robots.txt`, com limites de tempo/bytes. DNS é validado antes de cada conexão e fixado no acesso; IPs privados, localhost, metadados, portas e esquemas inseguros são bloqueados. Restrições em robots e bloqueios da página produzem resultado inconclusivo.

Não há inspeção visual, execução de JavaScript ou teste real de formulários. Lighthouse/PageSpeed é uma medição **opcional** que só ocorre com `PAGESPEED_API_KEY`; sem ela, a auditoria básica continua funcional e desempenho aparece como não medido.

## Publicação automática

O repositório já possui integração Git com o projeto Vercel `prospecta-ia`. `vercel.json` define instalação, build com testes, saída `public`, região `gru1` e limite de 60 segundos para a API. Novos commits na branch de produção são enviados pela integração existente; o build falha se as verificações falharem.

Nesta manutenção, o plugin Vercel recusou acesso à conta do projeto com **403**. O código está preparado para a integração existente, mas isso impede administrar a hospedagem ou confirmar sua configuração pelo plugin. O status da integração no GitHub permite confirmar a conclusão dos deploys, sem administrar o projeto pelo plugin; veja [validação](docs/VALIDACAO.md).

## Personalização técnica opcional

`.env.example` lista somente substituições opcionais. Para usar outro Supabase, informe **URL e chave publicável juntas**, instale `supabase/schema.sql` em um projeto vazio e configure Auth desse novo projeto. Não execute o schema inicial novamente no banco já instalado.

`ENABLE_OSM=false` desativa a busca; `AUDIT_MODE=disabled` desativa auditorias; `AUDIT_ALLOWED_HOSTS` restringe os domínios quando desejado. `DISABLE_CLOUD=true` com `APP_ACCESS_KEY` permite instalação individual sem Supabase, para auditorias, com limites por instância. A busca permanece pública nesse modo. Nunca envie senhas/tokens ao Git.

Fontes OSM têm validade de 30 dias; auditorias, sete dias. Retenção local segue preferências. Exclusão remota e revisão de registros vencidos são manuais. Não há disparo automático de mensagens, pagamentos, raspagem de Google Maps ou integração de IA generativa nesta versão.

[Contrato da API](docs/API.md) · [Pontuação](docs/PONTUACAO.md) · [Validação](docs/VALIDACAO.md)

A interface principal foi simplificada: filtros fechados por padrão, métricas compactas e cartões com nome, localização, potencial e contatos. Explicações, fontes e condições da avaliação ficam na ficha.
