# RFC-001 (Escolha do provedor de nuvem)

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADRs derivados:** ADR-001

## Contexto

O sistema precisa de cinco capacidades que não existem no ambiente local:

1. Um API Gateway, para roteamento e throttling
2. Execução serverless, para emissão de token e para notificações
3. Um banco de dados relacional gerenciado
4. Um cluster Kubernetes com escalabilidade automática
5. Um provider Terraform maduro, porque todo o provisionamento é versionado

Três restrições moldam a escolha. Custo pessoal zero, porque nenhum integrante vai colocar cartão de
crédito. Ciclo de vida efêmero, porque o ambiente sobe para demonstração e é destruído em seguida. E
janela de trabalho curta, porque o provisionamento completo precisa caber numa sessão.

Os três grandes provedores atendem as cinco capacidades. A decisão, então, não é sobre o que é possível,
e sim sobre onde o caminho é mais curto e previsível dentro dessas restrições.

## Alternativas avaliadas

### AWS

A favor: o provider Terraform mais maduro dos três, com a maior cobertura de recursos e a documentação
mais completa. O ecossistema de exemplos públicos é de longe o maior, o que encurta o tempo entre "preciso
fazer X" e "X está funcionando". O AWS Lambda é a implementação de referência do modelo serverless, e o
API Gateway integra com ele nativamente, por integração `AWS_PROXY`. As cinco capacidades ficam em API
Gateway, Lambda, RDS, EKS e Terraform. O AWS Academy dispensa cartão, e o grupo já tem familiaridade.

Contra: o control plane do EKS é cobrado por hora, ao contrário do AKS. A configuração de VPC, subnets e
security groups é a mais verbosa dos três. E o IAM é o modelo de permissões mais rigoroso, o que costuma
ser virtude e vira obstáculo numa conta educacional restrita.

### Google Cloud

A favor: o GKE é reconhecidamente o mais confortável de operar, e o modo Autopilot elimina a gestão de
nós, que é a parte trabalhosa. Faz sentido, já que o Kubernetes nasceu no Google. A configuração de VPC é
a mais simples dos três. O crédito inicial de US$ 300 cobre folgadamente o uso previsto, e Cloud SQL e
Cloud Functions cobrem as demais capacidades.

Contra: exige cartão de crédito para ativar o crédito, mesmo sem cobrança imediata. O Cloud API Gateway é
o menos maduro dos três, com integração menos direta com Cloud Functions. O ecossistema de exemplos é bem
menor, e o tempo gasto descobrindo o caminho incide inteiro sobre a janela de trabalho. E o Autopilot
esconde o node pool, o que é conveniente na operação e ruim para um projeto que precisa demonstrar
decisões de dimensionamento.

### Azure

A favor: o control plane do AKS é gratuito, o que torna a Azure a opção mais barata das três para essa
capacidade. O Azure for Students oferece crédito sem cartão. Azure Functions, Azure Database for
PostgreSQL e API Management cobrem as demais capacidades, e a integração é excelente para quem já vive no
ecossistema Microsoft.

Contra: é o provedor com que o grupo tem menos familiaridade, e a curva de aprendizado competiria
diretamente com a entrega. O provider Terraform é competente, mas o ecossistema de exemplos é o menor dos
três. E os Resource Groups introduzem um conceito a mais de organização para aprender num momento em que
não sobra tempo para isso.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Tempo até funcionar | A janela é curta, e cada hora descobrindo caminho é uma hora não construindo |
| Maturidade do provider Terraform | O provisionamento inteiro é código, e provider incompleto vira contorno manual |
| Integração entre API Gateway e função serverless | É metade do tráfego do sistema, e integração fraca ali obriga a inventar caminho paralelo |
| Familiaridade do grupo | Curva de aprendizado compete com entrega, não soma |
| Custo pessoal zero | Restrição rígida |

## Recomendação

AWS.

O critério que decide é o tempo até funcionar. Os três atendem as cinco capacidades, então a diferença
prática não está no que dá para fazer, e sim em quanto se gasta descobrindo como. A AWS tem o maior volume
de documentação, exemplos e respostas públicas dos três, e o provider Terraform mais completo. Numa janela
curta, isso vale mais que qualquer vantagem isolada de serviço.

O segundo argumento é a integração entre API Gateway e Lambda. Ela é metade do tráfego deste sistema,
porque o caminho de autenticação passa por lá. Na AWS a integração `AWS_PROXY` é nativa e direta. No GCP e
na Azure ela existe, mas é menos madura, e integração fraca nesse ponto obrigaria a expor a função por
endereço próprio, quebrando o ponto único de entrada que o ADR-001 estabelece.

O terceiro é familiaridade. O grupo já trabalhou com a AWS, e num projeto com prazo apertado a curva de
aprendizado não soma à entrega, compete com ela.

Vale reconhecer onde os outros dois ganham, porque a escolha não é unânime em todos os eixos. O GKE é o
mais agradável de operar, e o control plane do AKS é gratuito enquanto o do EKS é cobrado. Se o projeto
fosse operar o cluster por meses, esses dois pontos pesariam bem mais.

Só que o cluster aqui vive algumas horas por vez. O custo do control plane nesse regime é irrelevante, e o
conforto de operação não chega a ser exercitado. As duas vantagens reais do GCP e da Azure valem pouco
neste contexto específico, enquanto a vantagem da AWS (chegar mais rápido ao funcionamento) vale
exatamente onde a restrição aperta.

## Sobre a conta utilizada

A AWS é acessada pelo AWS Academy Learner Lab, o que atende a restrição de custo pessoal zero. Essa conta
tem limitações que não são da AWS, e sim do programa, mas que moldam as milestones de infraestrutura.
Estão registradas nas consequências abaixo.

## Consequências

Positivas:

- As cinco capacidades num provedor só, com um estado de infraestrutura coerente entre elas
- Ferramental de infraestrutura como código maduro e amplamente documentado
- Integração nativa entre gateway e função serverless
- Custo zero para o grupo, sem risco de fatura por esquecimento

Negativas, decorrentes da conta educacional:

- Não é possível criar IAM roles ou policies. Só existem `LabRole` e `LabInstanceProfile`, e todo recurso
  que exige uma role assume a `LabRole`. Isso invalida a maioria dos exemplos públicos de EKS com
  Terraform, que criam roles dedicadas. O código precisa referenciar a existente por `data`, e copiar
  exemplo sem adaptar falha de formas confusas.
- As credenciais de sessão expiram em cerca de quatro horas, e não é possível criar um OIDC provider para
  o GitHub Actions. O pipeline usa `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN` como
  secrets, que precisam ser atualizados a cada sessão. A mitigação é um script que atualiza os secrets dos
  quatro repositórios de uma vez.
- A região é fixa em `us-east-1`.
- O DocumentDB não está disponível, mas o RDS está. Isso restringe as opções da RFC-002 na prática, ainda
  que não decida por ela.
- O laboratório é encerrado ao fim da sessão, então o ambiente é efêmero por construção. Isso combina com
  o ciclo de vida previsto, mas elimina a possibilidade de manter algo no ar.

Negativas, do provedor em si:

- O control plane do EKS é cobrado por hora, ao contrário do AKS. No regime de uso deste projeto o valor é
  desprezível, mas num ambiente permanente seria um argumento real a favor da Azure.
- A configuração de rede é a mais verbosa dos três, o que se reflete na quantidade de HCL.

Riscos aceitos:

- O orçamento da conta educacional é limitado. O dimensionamento precisa ser enxuto e o ambiente destruído
  após cada uso, porque um cluster esquecido de pé consome o crédito restante.
- Se o Learner Lab bloquear a criação do EKS ou do VPC Link, a arquitetura precisa ser repensada.
  Verificar isso é o primeiro passo do provisionamento, antes de qualquer outro trabalho.

## Quando revisitar

Se o ambiente deixar de ser efêmero e passar a operar continuamente. Aí o custo do control plane do EKS e o
conforto de operação do GKE passam a pesar de verdade, e as vantagens da Azure e do Google Cloud deixam de
ser teóricas.
