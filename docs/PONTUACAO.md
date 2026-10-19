# Potencial individual de prospecção, regra 3.0.0

`evaluateOpportunity` retorna a pontuação de 0–100 somente quando existem dados individuais suficientes: ao menos duas informações comerciais além de nome/cidade e um canal utilizável, ou verificações manuais. Quando faltam esses dados, `score:null`, prioridade pendente e texto “Dados insuficientes” substituem a antiga nota repetida. Não se adiciona ruído, números aleatórios ou variação pelo nome do negócio.

A nota é um índice de prospecção, com justificativas e confiança. `probability:null` permanece: interesse, orçamento e decisão não são inferidos do cadastro. Uma mesma combinação de sinais pode legitimamente receber a mesma pontuação.

| Grupo | Avaliação inicial | Verificações registradas |
|---|---|---|
| Oportunidade digital, peso 45 | Domínio próprio informado: 5; rede/plataforma sem domínio: 15; ausência na fonte: 12 como investigação | Situação digital verificada substitui os pontos iniciais; ausência na fonte não prova ausência real |
| Dados comerciais, peso 20 | Quantidade de endereço, horários, descrição, serviços, telefone, e-mail, site e social; até 10 pontos, incluindo atualização conhecida de catálogo | Atividade recente e consistência verificadas prevalecem; dado publicado não confirma operação atual |
| Adequação da solução, peso 15 | Perfis diferentes para catálogo, agendamento, projeto, cardápio e presença institucional. Veículos/imóveis: até 15; engenharia: 14,5; móveis: 14; contabilidade: 14; moda/educação: 13,5; saúde: 13; beleza/fitness: 12,5; alimentação/pets: 12; oficina: 11,5; mercado: 8; outros: 6 | Caso de uso, organização e benefício registrados substituem cada hipótese, inclusive avaliações negativas |
| Contato, peso 10 | Telefone: 3; e-mail: 2; rede social: 1; WhatsApp explícito: 4; soma limitada a 7 sem confirmação direta | WhatsApp confirmado: 7; outro canal confirmado: 3; pesquisa sem canal pode ser zero conhecido |
| Negociação, peso 10 | Sem sinal registrado: zero | Interesse explícito: 5; próximo passo confirmado: 5 |

Pesos e limiares continuam configuráveis. Não se divide a nota pela cobertura para inflar uma base incompleta. A confiança descreve a qualidade das verificações, sem representar intervalo estatístico: alta exige identidade/elegibilidade e 80% de cobertura; média, identidade e 40%; demais casos são baixos.

Não contatar, encerrado, duplicado, fora do escopo, Fechado, Perdido e interesse negado ficam fora da prospecção ativa. Identidade negada ou conflitante exige revisão. Escolas/creches identificadas como estaduais/municipais/públicas no nome e unidades de saúde nomeadas UBS/Unidade Básica de Saúde ficam fora da prioridade de comércios privados, com justificativa sujeita a revisão.

Fontes vencidas, campos conflitantes e informações sem retenção permitida não contam. Um domínio publicado não é rotulado como site ruim sem análise. A confiança de existência da base Overture não vira disposição de compra. Os prompts usam a proposta correspondente ao perfil e aos campos efetivamente disponíveis.

## Índice de evidências, regra 1.0.0

Índice de 0–100 para organizar investigação e abordagem. **Não é probabilidade de fechamento**. A função pura `calculateScore` retorna pontos, pesos cobertos, justificativas, motivos, pendências, versão e data. As regras e os limites usados ficam nos snapshots; uma mudança de configuração afeta a análise atual, sem alterar o histórico.

| Critério | Pontos padrão | Avaliação |
|---|---:|---|
| Necessidade digital | 45 | ausência confirmada 45; não localizado/redes apenas com pesquisa suficiente 35; site com problemas até 40; adequado e avaliado 0; inconclusivo pendente |
| Operação | 20 | atividade recente em canal oficial 10; informação atual/consistente 10 |
| Adequação de site | 15 | caso de uso 5; organização da informação 5; benefício específico 5; hipóteses justificadas |
| Contatos | 10 | WhatsApp confirmado 7; outro canal comercial confirmado 3; pesquisa realizada sem canal pode ser zero conhecido |
| Interesse registrado | 10 | interesse explícito 5; próximo passo/prazo combinado 5; não registrado e pesquisado pode ser zero conhecido |

Justificativa, fonte com retenção permitida e estado conhecido são necessários para contar cobertura. Campos conflitantes, vencidos ou ausentes são pendentes. Ausência de informação não significa empresa inativa. Nome/atividade/bairro não permitem inferir dinheiro disponível ou interesse.

## Site existente: testes definidos antes da pontuação

| Grupo | Teste único | Pontos por falha verificada |
|---|---|---:|
| Disponibilidade/HTTPS | `availability`: resposta não 2xx/3xx analisável na URL; `https`: ausência de HTTPS | 5 + 5 |
| Marcadores mobile/acessibilidade | `viewport`: meta ausente; `imageAlt`: imagem sem atributo alt | 5 + 5 |
| Contato/conversão | `contact`: ausência comprovada após revisão; `cta`: ausência/falha comprovada após revisão | 5 + 5 |
| Conteúdo/desempenho | `title`: vazio/ausente; `description`: vazia/ausente; `performance`: Lighthouse mobile real abaixo de 50 | 3 + 2 + 5 |

Pass/fail precisam de evidência textual. `unknown` não conta. Uma falha repetida com o mesmo id conta uma única vez. A auditoria automática não comprova a ausência de contatos/CTA, apenas registra presença ou necessidade de inspeção, portanto esses critérios podem permanecer pendentes. Não se apresenta o marcador `viewport` como teste visual de experiência mobile. HTTPS inseguro é bloqueado pelo transporte da auditoria, de forma que esse critério não recebe uma falha inventada a partir de uma URL bloqueada. Um 403/429/5xx ou timeout interrompe a análise e não vira “site ruim”.

Para sites com problemas, a cobertura digital é a proporção dos 40 pontos de testes efetivamente verificados multiplicada por 45. A pontuação digital máxima continua 40/45; em outro peso configurado, é escalada por `peso/45`. Demais grupos também são escalados pelos pesos configurados, que devem somar 100.

Cobertura total = soma dos pesos efetivamente avaliados / 100. Não se divide a pontuação pela cobertura para produzir nota alta artificialmente.

Alta: ≥80; média: 60–79; baixa: <60. Cobertura <70%, identidade não confirmada ou situação inconclusiva → **Aguardando análise**. Encerrada/duplicada/fora do escopo/Não contatar → fora da abordagem. Os limiares são configuráveis. Nenhuma IA altera valores.
