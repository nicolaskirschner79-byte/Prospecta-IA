# Fontes e permissões

Documentação consultada em 19/10/2026. Esta implementação não assume que “público” significa uso irrestrito.

## OpenStreetMap / Overpass

- [Copyright/licença](https://www.openstreetmap.org/copyright): ODbL; atribuição e compartilhamento aplicável à base derivada. O app mostra atribuição e inclui licença/fontes nas exportações.
- [Overpass API e instâncias públicas](https://wiki.openstreetmap.org/wiki/Overpass_API): serviço de consulta de dados OSM, limites de infraestrutura e disponibilidade variáveis.
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL): áreas, filtros por tags, limites de saída e timeout. Dois endpoints fixos e documentados, sem permitir URL arbitrária de fornecedor pelo cliente. Servidor alternativo: https://overpass.private.coffee/api/interpreter; retentativa somente para falhas transitórias, nunca para contornar HTTP 429.

Campos usados: nome, tags de atividade/segmento, endereço publicado, telefone, e-mail, site, canal social, horários. Cidade/UF da área de pesquisa, sem tag correspondente, são marcadas como inferência. Não são coletados proprietários, contatos privados, faturamento, CNPJ inferido, avaliações ou fotos sem licença.

Retenção prevista: até 30 dias para verificação/uso antes de revisão. Exportação e uso de fatos em briefings preservam fonte e ODbL. O usuário continua responsável por identificar as obrigações aplicáveis à distribuição concreta de seu banco derivado; atribuição isolada não remove obrigações de compartilhamento. Nenhum snapshot/proposta pode remover restrição da fonte.

Dados OSM não comprovam publicação pela própria empresa. Mesmo que exista tag WhatsApp, a implementação não a transforma automaticamente em contato confirmado. Uma pessoa deve conferir o canal do negócio e registrar evidência. Sem site na tag, a conclusão é inconclusiva.

## Photon / índice OpenStreetMap

- [Projeto oficial mantido pela komoot](https://github.com/komoot/photon), [contrato HTTP](https://github.com/komoot/photon/blob/master/docs/api-v1.md) e [filtros por categoria](https://github.com/komoot/photon/blob/master/docs/categories.md), consultados em 19/10/2026.
- O servidor público `https://photon.komoot.io` aceita uso razoável, sem garantia de disponibilidade; uso excessivo pode ser limitado. O app limita chamadas, reaproveita consultas iguais e respeita HTTP 429 sem recorrer a outra fonte para contorná-lo.
- Busca de área com `q`, `countrycode=BR` e `layer=city`; correspondência de nome/UF obrigatória. A busca comercial usa a área `bbox`, um único parâmetro `include` com categorias separadas por vírgula (OR) e até 50 candidatos. Cada candidato precisa informar a cidade, estado e país corretos; categoria também é conferida localmente.
- O índice é uma amostra e pode não incluir telefone, site ou e-mail. Esses campos ficam ausentes; não são inventados nem buscados em páginas de terceiros. As fontes preservam a URL do objeto OSM e ODbL, com identificação do índice Photon. Dados colaborativos podem conter erros e exigem confirmação de identidade.
- A API de edição do OpenStreetMap não é usada como motor de consulta de comércios.

## Cadastro e importação autorizados

O usuário declara direitos de retenção, exportação e IA separadamente e informa origem/data. Exportação e IA vêm desmarcadas por padrão. Cada campo corrigido recebe uma nova fonte; valores inalterados preservam sua origem. Duplicatas/homônimos exigem revisão. Não importar bases restritas sob uma autorização genérica falsa.

## Auditoria de sites autorizados

Confirmação do vínculo na ficha + confirmação de autorização na ação autenticada. A lista de hosts é limitada à URL dessa operação e à variante www; uma lista mais restritiva no ambiente, quando fornecida, prevalece. As evidências retornadas são análises limitadas, não cópias indiscriminadas de páginas. Uma página e robots, com limite de bytes/tempo; sem screenshots, varredura de avaliações ou login. Qualquer Disallow não vazio requer revisão para esta versão. Revalidar permissões quando usar um fornecedor diferente.

## PageSpeed

[API oficial](https://developers.google.com/speed/docs/insights/v5/get-started). Ativação por chave do ambiente, quota/custos conforme projeto. Medição mobile identificada com data, resultado de laboratório, sem fingir testes que não foram realizados. Erros de chave, limite ou timeout ficam como medição indisponível.

## Supabase

- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Proteção da API](https://supabase.com/docs/guides/api/securing-your-api).
- [Auth signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
- [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
- [Changelog](https://supabase.com/changelog.md) e [retirada de cifras TLS antigas](https://supabase.com/changelog/cbc-tls-ciphers-deprecated): usar runtimes/navegadores modernos; o projeto usa APIs TLS atuais.

## Fora da integração

Google Maps/Places, Instagram e Facebook não são raspados. Não há leitura de páginas autenticadas, bypass de bloqueios ou banco exportável de leads derivado do Google Places. Links de canais fornecidos pelo usuário podem ser exibidos sem que o app alegue acesso ao conteúdo. IA generativa externa não está integrada; o produto entrega o fallback por template solicitado no escopo.

## Índice municipal para acelerar a consulta

A [API oficial de Localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades) forneceu os 5.571 nomes/identificadores municipais em 19/10/2026. O snapshot reduzido fica em `server/data/municipalities.js`, para validação no servidor. O catálogo da interface fica dividido em 27 arquivos estáticos `public/data/cities/{UF}.json`, cerca de 207 KB no total; só o estado selecionado é carregado e cada catálogo é reutilizado na sessão. Não depende de uma chamada externa para preencher as opções. Não contém cadastros de empresas.

O código oficial delimita a área OSM por `IBGE:GEOCODIGO` ou `ref:IBGE`. A relação OSM [Itapeva/SP, 298034](https://www.openstreetmap.org/relation/298034) foi inspecionada pela API oficial: `admin_level=8`, `IBGE:GEOCODIGO=3522406`. O Distrito Federal usa a área `BR-DF`. A ausência de área ou de comércios na amostra não comprova ausência de negócios reais.
