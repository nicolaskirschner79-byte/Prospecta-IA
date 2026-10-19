# Fontes e permissões

Documentação consultada em 19/10/2026. Esta implementação não assume que “público” significa uso irrestrito.

## OpenStreetMap / Overpass

- [Copyright/licença](https://www.openstreetmap.org/copyright): ODbL; atribuição e compartilhamento aplicável à base derivada. O app mostra atribuição e inclui licença/fontes nas exportações.
- [Overpass API e instâncias públicas](https://wiki.openstreetmap.org/wiki/Overpass_API): serviço de consulta de dados OSM, limites de infraestrutura e disponibilidade variáveis.
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL): áreas, filtros por tags, limites de saída e timeout. Endpoint fixo, sem permitir URL arbitrária de fornecedor pelo cliente.

Campos usados: nome, tags de atividade/segmento, endereço publicado, telefone, e-mail, site, canal social, horários. Cidade/UF da área de pesquisa, sem tag correspondente, são marcadas como inferência. Não são coletados proprietários, contatos privados, faturamento, CNPJ inferido, avaliações ou fotos sem licença.

Retenção prevista: até 30 dias para verificação/uso antes de revisão. Exportação e uso de fatos em briefings preservam fonte e ODbL. O usuário continua responsável por identificar as obrigações aplicáveis à distribuição concreta de seu banco derivado; atribuição isolada não remove obrigações de compartilhamento. Nenhum snapshot/proposta pode remover restrição da fonte.

Dados OSM não comprovam publicação pela própria empresa. Mesmo que exista tag WhatsApp, a implementação não a transforma automaticamente em contato confirmado. Uma pessoa deve conferir o canal do negócio e registrar evidência. Sem site na tag, a conclusão é inconclusiva.

## Cadastro e importação autorizados

O usuário declara direitos de retenção, exportação e IA separadamente e informa origem/data. Exportação e IA vêm desmarcadas por padrão. Cada campo corrigido recebe uma nova fonte; valores inalterados preservam sua origem. Duplicatas/homônimos exigem revisão. Não importar bases restritas sob uma autorização genérica falsa.

## Auditoria de sites autorizados

Domínio permitido no ambiente + confirmação do vínculo na ficha + confirmação de autorização na ação. As evidências retornadas são análises limitadas, não cópias indiscriminadas de páginas. Uma página e robots, com limite de bytes/tempo; sem screenshots, varredura de avaliações ou login. Qualquer Disallow não vazio requer revisão para esta versão. Revalidar permissões quando usar um fornecedor diferente.

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
