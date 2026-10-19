# Prospecta IA

Prospecção de comércios para criação de sites: busca → ficha com fontes → avaliação da oportunidade → briefing → contato revisado → negociação.

## Pronto para esta instalação

O projeto **Prospecta IA** no Supabase já está conectado pelo código. As tabelas, políticas de isolamento entre contas e função de quota foram instaladas e verificadas no banco. A busca OpenStreetMap já vem ativada e identificada com o endereço deste repositório. **Não é necessário criar `.env.local`, copiar chaves ou executar SQL para usar esta instalação.**

1. Abra o site, escolha o estado e selecione uma cidade no catálogo pesquisável. Se desejar, informe segmento, palavra-chave e bairro.
2. Clique em **Buscar comércios**. **Não é preciso cadastro, login ou código de acesso**, inclusive para atualizar os detalhes da fonte.
3. Os novos resultados são salvos automaticamente neste navegador. A conta é opcional para sincronização entre dispositivos; você pode entrar pelo menu quando desejar.
4. Cada cartão já mostra o potencial comercial de 0–100, a prioridade, os motivos e a confiança da avaliação. A análise inicial usa os dados publicados e hipóteses específicas do segmento; confirmar identidade e registrar evidências melhora a avaliação. A nota não é uma probabilidade estatística de compra.
5. Abra **Ver prompt pronto** para copiar ou baixar o prompt profissional completo, organizado em 14 seções e adaptado ao segmento, nome, localização e demais dados disponíveis. A personalização adicional é opcional. Contatos e mensagens exigem revisão; WhatsApp só é ativado para um número confirmado com país e DDD.

Os prompts são preparados automaticamente no navegador por **15 perfis de segmento e uma estrutura de 14 seções**, sem API paga ou configuração de IA. Incluem direção comercial, design e paleta propostos, arquitetura, copy, funcionalidades, ativos, acessibilidade, SEO local, requisitos técnicos e testes. A identidade visual só é descrita como observada quando há registro; dados ausentes são identificados para confirmação. O sistema não executa um modelo generativo. O conteúdo pode ser copiado ou baixado para outra ferramenta, conforme as permissões da fonte.

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

- Fonte principal: índice Photon/OpenStreetMap (`https://photon.komoot.io`). A área municipal é localizada pela cidade e UF, e os resultados são conferidos por cidade, estado, país e categoria. Se houver falha transitória, uma consulta Overpass com prazo de cinco segundos tenta recuperar o resultado. HTTP 429 é respeitado, sem troca de fonte para contornar limite.
- Catálogo de cidades por estado com 5.571 nomes oficiais do IBGE, incluindo acentos. Os 27 arquivos locais em `public/data/cities` dispensam outra API para preencher o seletor. Digitar “sao” encontra “São”; trocar a UF limpa a cidade anterior e impede pesquisar uma cidade de outro estado.
- Cache por dez minutos no navegador e na instância, com agregação de chamadas iguais. Consultas GET públicas permitem cache na CDN do Vercel entre instâncias. Somente respostas bem-sucedidas são armazenadas; erros continuam sem cache. A data original da coleta é preservada.
- O índice municipal no servidor valida cidade/UF sem depender de rede. A contingência Overpass usa códigos IBGE nas áreas OSM. A geocodificação do Photon, guardada por 24 horas, resolve homônimos conferindo a UF; candidatos sem cidade/estado correspondentes são descartados.
- O Photon tem prazo total de sete segundos para localizar a área e consultar a amostra; a contingência Overpass tem cinco segundos. O navegador encerra a operação em 18 segundos e oferece **Cancelar busca**. Um timeout com lista vazia é tratado como falha, nunca como pesquisa concluída sem comércios.
- Em indisponibilidade, uma consulta bem-sucedida anterior pode ser mostrada por até 12 horas, com aviso e data original. Sem uma consulta salva, o erro é exibido e os registros existentes são preservados. Serviços públicos externos não têm disponibilidade garantida.
- Até 50 candidatos no Photon; até 100 objetos e 50 resultados na contingência Overpass. Palavra-chave/bairro filtram a amostra. A cobertura é parcial, os contatos podem não estar disponíveis e não há paginação externa.
- A falta de website no cadastro não comprova ausência de site. Telefones não viram WhatsApp automaticamente. Falhas externas nunca são substituídas por comércios inventados.
- Atribuição **© OpenStreetMap contributors**, licença ODbL e fontes são preservadas nas exportações. Consulte [fontes e permissões](docs/FONTES.md).

## Avaliação e prompts automáticos

- Novas buscas, cadastros e importações já recebem um prompt pronto. Bases antigas são atualizadas em memória ao carregar, sem refazer a busca e sem envio de dados a um provedor de IA.
- `evaluateOpportunity` calcula potencial de venda e prioridade desde o primeiro cadastro. As hipóteses por segmento são identificadas; contato, interesse e presença digital confirmados prevalecem sobre sugestões. A confiança inicial é baixa quando faltam verificações. Negócios encerrados, perdidos ou suprimidos ficam fora da prospecção ativa.
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
