# RFC-001 (Escolha do provedor de nuvem)

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADRs derivados:** ADR-001

## Contexto

O sistema precisa de cinco capacidades que não existem no ambiente local:

1. Um ponto único de entrada para as APIs, com roteamento e controle de vazão
2. Execução serverless, para emissão de token e para notificações
3. Um banco de dados relacional gerenciado
4. Um cluster de contêineres com escalabilidade automática
5. Suporte maduro a infraestrutura como código, porque todo o provisionamento é versionado

Três restrições moldam a escolha. Custo pessoal zero, porque nenhum integrante vai colocar cartão de
crédito. Ciclo de vida efêmero, porque o ambiente sobe para demonstração e é destruído em seguida. E
janela de trabalho curta, porque o provisionamento completo precisa caber numa sessão.

Os três grandes provedores atendem as cinco capacidades. A decisão, então, não é sobre o que é possível,
e sim sobre onde o caminho é mais curto e previsível dentro dessas restrições.

## Alternativas avaliadas

### AWS

A favor: o provedor de infraestrutura como código mais maduro dos três, com a maior cobertura de recursos
e a documentação mais completa. O ecossistema de exemplos públicos é de longe o maior, o que encurta o
tempo entre "preciso fazer X" e "X está funcionando". A função serverless é a implementação de
referência do modelo, e o gateway de API integra com ela nativamente, sem intermediário. Tem programa
educacional que dispensa cartão. O grupo já tem familiaridade.

Contra: o plano de controle do cluster gerenciado é cobrado por hora, ao contrário de um dos concorrentes.
A superfície de configuração de rede é a mais verbosa dos três. E o modelo de permissões é o mais
rigoroso, o que costuma ser virtude e vira obstáculo em contas educacionais restritas.

### Google Cloud

A favor: o serviço de cluster gerenciado é reconhecidamente o mais confortável de operar, e o modo
automático elimina a gestão de máquinas, que é a parte trabalhosa. Faz sentido, já que o próprio
Kubernetes nasceu ali. A configuração de rede é a mais simples dos três. O crédito inicial é generoso e
cobre folgadamente o uso previsto.

Contra: exige cartão de crédito para ativar o crédito inicial, mesmo sem cobrança imediata. O gateway de
API é o menos maduro dos três, com integração menos direta com a função serverless. O ecossistema de
exemplos é bem menor, e o tempo gasto descobrindo o caminho incide inteiro sobre a janela de trabalho. O
modo automático do cluster esconde o conjunto de máquinas, o que é conveniente na operação e ruim para um
projeto que precisa demonstrar decisões de dimensionamento.

### Azure

A favor: o plano de controle do cluster gerenciado é gratuito, o que o torna a opção mais barata das três
para essa capacidade. O programa educacional oferece crédito sem cartão. A integração é excelente para
quem já vive no ecossistema Microsoft.

Contra: é o provedor com que o grupo tem menos familiaridade, e a curva de aprendizado competiria
diretamente com a entrega. O provedor de infraestrutura como código é competente, mas o ecossistema de
exemplos é o menor dos três. E o modelo de recursos, com grupos de recursos como unidade de organização,
introduz um conceito a mais para aprender num momento em que não sobra tempo para isso.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Tempo até funcionar | A janela é curta, e cada hora descobrindo caminho é uma hora não construindo |
| Maturidade do ferramental de infraestrutura como código | O provisionamento inteiro é código, e provedor incompleto vira contorno manual |
| Integração entre gateway e função serverless | É metade do tráfego do sistema, e integração fraca ali obriga a inventar caminho paralelo |
| Familiaridade do grupo | Curva de aprendizado compete com entrega, não soma |
| Custo pessoal zero | Restrição rígida |

## Recomendação

AWS.

O critério que decide é o tempo até funcionar. Os três provedores atendem as cinco capacidades, então a
diferença prática não está no que dá para fazer, e sim em quanto se gasta descobrindo como. A AWS tem o
maior volume de documentação, exemplos e respostas públicas dos três. Numa janela curta, isso vale mais
que qualquer vantagem isolada de serviço.

O segundo argumento é a integração entre gateway e função serverless. Ela é metade do tráfego deste
sistema, porque o caminho de autenticação passa por lá. Na AWS essa integração é nativa e direta. Nos
outros dois ela existe, mas é menos madura, e integração fraca nesse ponto obrigaria a expor a função por
endereço próprio, quebrando o ponto único de entrada que o ADR-001 estabelece.

O terceiro é familiaridade. O grupo já trabalhou com a AWS, e num projeto com prazo apertado a curva de
aprendizado não soma à entrega, compete com ela.

Vale reconhecer onde os outros dois ganham, porque a escolha não é unânime em todos os eixos. O serviço
de cluster do Google é o mais agradável de operar, e o plano de controle da Azure é gratuito enquanto o
da AWS é cobrado. Se o projeto fosse operar o cluster por meses, esses dois pontos pesariam bem mais.

Só que o cluster aqui vive algumas horas por vez. O custo do plano de controle nesse regime é
irrelevante, e o conforto de operação não chega a ser exercitado. As duas vantagens reais dos
concorrentes valem pouco neste contexto específico, enquanto a vantagem da AWS (chegar mais rápido ao
funcionamento) vale exatamente onde a restrição aperta.

## Sobre a conta utilizada

A AWS é acessada pelo programa educacional, o que atende a restrição de custo pessoal zero. Essa conta
tem limitações que não são do provedor, e sim do programa, mas que moldam as milestones de
infraestrutura. Estão registradas nas consequências abaixo.

## Consequências

Positivas:

- As cinco capacidades num provedor só, com um estado de infraestrutura coerente entre elas
- Ferramental de infraestrutura como código maduro e amplamente documentado
- Integração nativa entre gateway e função serverless
- Custo zero para o grupo, sem risco de fatura por esquecimento

Negativas, decorrentes da conta educacional:

- Não é possível criar funções de acesso novas. Todo recurso que exige uma assume a existente. Isso
  invalida a maioria dos exemplos públicos de cluster com infraestrutura como código, que criam funções
  dedicadas. O código precisa referenciar a existente, e copiar exemplo sem adaptar falha de formas
  confusas.
- As credenciais de sessão expiram em cerca de quatro horas, e não há autenticação federada disponível. O
  pipeline usa credenciais estáticas em segredos, que precisam ser atualizadas a cada sessão. A mitigação
  é um script que atualiza os segredos dos quatro repositórios de uma vez.
- A região é fixa.
- O banco de documentos gerenciado não está disponível, o que restringe as opções da RFC-002 na prática,
  ainda que não decida por ela.
- O laboratório é encerrado ao fim da sessão, então o ambiente é efêmero por construção. Isso combina com
  o ciclo de vida previsto, mas elimina a possibilidade de manter algo no ar.

Negativas, do provedor em si:

- O plano de controle do cluster gerenciado é cobrado por hora, ao contrário do concorrente que o oferece
  gratuitamente. No regime de uso deste projeto o valor é desprezível, mas num ambiente permanente seria
  um argumento real a favor da Azure.
- A configuração de rede é a mais verbosa dos três, o que se reflete na quantidade de código de
  infraestrutura.

Riscos aceitos:

- O orçamento da conta educacional é limitado. O dimensionamento precisa ser enxuto e o ambiente destruído
  após cada uso, porque um cluster esquecido de pé consome o crédito restante.
- Se a conta bloquear a criação do cluster ou da ligação de rede privada, a arquitetura precisa ser
  repensada. Verificar isso é o primeiro passo do provisionamento, antes de qualquer outro trabalho.

## Quando revisitar

Se o ambiente deixar de ser efêmero e passar a operar continuamente. Aí o custo do plano de controle e o
conforto de operação do cluster passam a pesar de verdade, e as vantagens da Azure e do Google Cloud
deixam de ser teóricas.
