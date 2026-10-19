# Avaliação automática de potencial comercial, regra 2.0.0

A interface usa `evaluateOpportunity` para avaliar todos os comércios desde a primeira busca. Retorna score de 0–100, prioridade, motivos, proposta, próxima ação, confiança e cobertura de evidências. `probability` é `null`: a plataforma não tem dados de conversão para estimar uma probabilidade de fechamento calibrada. A nota organiza a prospecção e não presume dinheiro, intenção ou decisão de compra.

| Critério | Pontuação inicial padrão | Evolução com evidências |
|---|---|---|
| Oportunidade digital, peso 45 | Domínio informado: 5; somente rede cadastrada: 15; nenhum domínio/rede: 12, como oportunidade de investigação | Critério digital verificado da regra de evidências substitui integralmente a hipótese; não se acumulam pontos |
| Informações/operação, peso 20 | Completude de nome, cidade, endereço, horários, descrição e serviços: até 4 pontos por verificação ainda desconhecida, máximo 8 | Atividade recente e consistência confirmadas: até 10 cada; respostas negativas valem zero e prevalecem |
| Utilidade de um site, peso 15 | Até 15 para segmentos definidos, 6 para outros serviços; hipóteses explicadas pelo perfil | Caso de uso, organização e benefício registrados substituem cada hipótese; um resultado negativo não é substituído por uma sugestão |
| Contato, peso 10 | Telefone/e-mail publicado: 3; rede social: 1; sem canal: 0 | WhatsApp confirmado: 7; outro canal confirmado: 3; pesquisa sem contato não inventa canal |
| Negociação, peso 10 | Sem sinal registrado: zero | Interesse explícito: 5; próximo passo confirmado: 5 |

Os valores escalam pelos pesos configurados, sem dividir pela cobertura para produzir notas altas. Os mesmos limiares configuráveis de prioridade se aplicam. O cadastro incompleto já tem avaliação preliminar; não precisa aguardar um formulário manual para ser ordenado. A maior parte das amostras sem contato nem evidências permanece com nota e confiança baixas, em vez de receber uma alta chance inventada.

Confiança alta exige identidade, elegibilidade e pelo menos 80% de cobertura da análise por evidências; média exige identidade confirmada e 40%; demais casos são baixos. Isso descreve a base da avaliação, sem representar intervalo estatístico de confiança. Conflitos ou identidade negada bloqueiam prioridade ativa; fontes vencidas não contam. Não contatar, encerrado, duplicado, fora do escopo, Fechado, Perdido e falta de interesse explicitamente registrada ficam fora da prospecção ativa.

Registros de educação cujo nome começa por “Escola/Creche Estadual/Municipal/Pública” e registros de saúde iniciados por “UBS” ou “Unidade Básica de Saúde” ficam fora da prioridade de comércios privados. É uma indicação pelo nome, exibida como tal e sujeita a revisão; não é uma investigação jurídica da instituição.

Os perfis por segmento também orientam o que propor e o próximo passo. A classificação usa dados permitidos para retenção e não realiza navegação, auditoria ou uma chamada de IA escondida.

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
