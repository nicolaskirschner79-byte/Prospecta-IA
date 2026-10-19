# Validação da entrega

Data: 19/10/2026. Node.js 24.19.0. Sem segredos ou banco Supabase de produção configurados.

## Verificações executadas

`npm run check`: sintaxe de todos os módulos JavaScript, configuração JSON e existência dos ativos referenciados no HTML.

`npm test`: **37 testes aprovados** na rodada documentada, usando Node test runner:

- Normalização, URLs, WhatsApp confirmado e não confirmado, mensagem codificada com acentos/quebras; nenhum clique altera a etapa.
- CSV com aspas/vírgulas/linhas internas; proteção de fórmulas; duplicatas e homônimos para revisão.
- Direitos por campo/fonte, validade/conflitos, restrição de exportação e envio a IA, impossibilidade de ampliar licença da fonte com uma permissão do campo.
- Score determinístico, cobertura conhecida vs. desconhecida, pesquisa insuficiente, identidade ambígua, exclusão de Não contatar/encerradas/duplicadas, falhas únicas e ausência sem dupla contagem; histórico preservado ao mudar pesos.
- Template de 14 seções, dados faltantes declarados, proposta visual separada da identidade observada, conservação de UTF-8.
- Backend HTTP local em porta efêmera para testes: configuração, arquivo público, cabeçalhos de segurança, fonte ausente e não exposição de código de servidor.
- Provedor OSM com transporte substituído: normalização, resposta parcial, limite e resposta inválida. São fixtures sintéticas, não empresas ou resultados reais.
- Auditoria com transporte substituído: critérios efetivamente observáveis, desempenho não medido, 403/429 e revisão de robots; não se inventa nota de Lighthouse.
- SSRF: IPs privados/reservados/metadados IPv4/IPv6, portas/esquemas, hosts não autorizados e DNS público/privado misturado. A função valida DNS antes da conexão e fixa o endereço consultado.
- Schema e testes SQL executados em **Postgres PGlite**: duas identidades, leitura/insert/update/delete, bloqueio de reassociação de proprietário, isolamento de perfil, bloqueio anônimo, proteção da tabela de quota e reserva/recusa de quota. O contrato `auth.uid()` é simulado no harness; as políticas e funções da entrega são executadas de verdade pelo Postgres.
- Fluxo da interface em **DOM LinkeDOM**: primeira utilização → demonstração separada → filtro → ficha com URL → geração de versão integral → ausência de WhatsApp fictício → favorito → voltar com filtro preservado. Não equivale a um navegador com layout/renderização.

## Tentativa de integração ao vivo

Uma consulta real limitada de barbearias/salões em Itapeva/SP foi tentada no endpoint Overpass usando a URL pública do repositório como identificação. A requisição excedeu o timeout de 25 segundos. **Nenhum resultado ao vivo foi validado, importado ou substituído por dados demonstrativos.** A integração implementa o protocolo real e possui testes de contrato; seu funcionamento no ambiente final ainda precisa de validação.

## Pendente de configuração/verificação

| Item | Estado |
|---|---|
| Fonte OpenStreetMap no ambiente final | Ativar ENABLE_OSM, identificação, autenticação e validar disponibilidade/área |
| Supabase Auth + REST em projeto real | Configurar URL/chave publicável, instalar schema, SMTP/confirmar e testar duas contas reais |
| Auditoria de empresa real | Confirmar domínio/identidade, permissão e allowlist; não executada |
| PageSpeed ao vivo | Chave/quota e medição não configuradas |
| IA generativa externa | Fora desta implementação; fallback por template está funcional |
| Vercel/URL publicada | Adaptador/configuração preparados; sem implantação realizada |
| Layout real 360, 390, 768, 1024 e 1440 px | CSS responsivo previsto; inspeção em navegador/dispositivo não realizada no ambiente disponível |
| Teclado/leitor de tela/clipboard/download em navegador real | Semântica, foco, tabs, fallback e arquivos implementados; requer validação assistiva/manual |

Não há alegação de “100% funcionando” ou de cobertura de todos os comércios. Autenticação/busca/auditoria externas dependem dos serviços e das configurações acima. Cadastro/importação local, pontuação, briefing por template e organização comercial funcionam sem esses serviços.

## Roteiro de aceite manual

Executar o servidor; cadastrar um registro autorizado com fontes/contato internacional; revisar evidências; conferir pontos e pendências; gerar briefing Para IA; editar e salvar nova versão; copiar com clipboard e testar fallback negando a permissão; baixar `.txt` e conferir o final do texto/acentos; conferir destino WhatsApp sem enviar; registrar contato/proposta manualmente; recarregar e conferir persistência. Importar CSV de teste e revisar duplicatas; repetir em duas contas após configurar Supabase. Testar tamanhos e teclado acima, zoom 200% e prefers-reduced-motion.
