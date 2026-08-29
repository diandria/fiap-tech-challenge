# RFC-001 — Escolha do provedor de nuvem

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADRs derivados:** ADR-001

## Contexto

O sistema precisa de cinco capacidades de infraestrutura que não existem no ambiente local: um ponto
único de entrada para as APIs, execução serverless, um banco de dados gerenciado, um cluster
Kubernetes com escalabilidade automática, e um provider Terraform maduro para provisionar tudo como
código.

Três restrições moldam a escolha e não são negociáveis:

- **Custo pessoal zero.** Nenhum integrante vai colocar cartão de crédito.
- **Ciclo de vida efêmero.** O ambiente sobe para demonstração e é destruído em seguida. Não há
  operação contínua.
- **Janela de trabalho curta.** O provisionamento completo precisa caber numa sessão.

## Alternativas avaliadas

### AWS Academy — Learner Lab

**Prós:** cobre as cinco capacidades sem custo pessoal. O provider Terraform da AWS é o mais maduro
do mercado, e o ecossistema de documentação é o maior — o que reduz o tempo de descobrir como fazer
algo.

**Contras:** só as roles `LabRole` e `LabInstanceProfile` existem, e não é possível criar IAM roles
ou policies. As credenciais de sessão expiram em cerca de quatro horas, o que inviabiliza
autenticação federada por OIDC no pipeline. Região fixa em `us-east-1`. O laboratório é encerrado ao
fim da sessão. DocumentDB indisponível; RDS disponível.

### AWS — conta própria no free tier

**Prós:** controle total de IAM, o que permite Terraform limpo e OIDC no pipeline, eliminando
credenciais estáticas. Sem expiração de sessão nem restrição de região.

**Contras:** o control plane do EKS cobra por hora fora do free tier, e um NAT Gateway custa mais que
o próprio cluster em ambiente pequeno. Exige cartão de um integrante e disciplina de destruir — um
esquecimento vira fatura pessoal.

### Google Cloud — crédito inicial

**Prós:** o GKE Autopilot remove a gestão de nós, que é a parte trabalhosa do EKS. Cloud SQL, Cloud
Functions e API Gateway cobrem as demais capacidades, e o crédito inicial cobre folgadamente o uso
previsto. Provider Terraform maduro.

**Contras:** também exige cartão para ativar o crédito. O grupo tem menos familiaridade, e o custo de
aprendizado incide sobre a janela de trabalho. O Autopilot esconde o node group — conveniente na
operação, ruim para demonstrar decisões de dimensionamento.

### Azure for Students

**Prós:** crédito sem cartão para contas educacionais. O AKS é competente e o provider Terraform
funciona bem.

**Contras:** a menor familiaridade das quatro opções, e o ecossistema de exemplos de Terraform para
AKS é o menor. O tempo gasto descobrindo o caminho competiria diretamente com o de construir.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Custo pessoal zero | Restrição rígida — elimina qualquer opção que exija cartão |
| Cobertura das cinco capacidades | Uma faltando obrigaria a misturar provedores, e a misturar estados de Terraform |
| Maturidade do provider Terraform | O provisionamento inteiro é código; provider imaturo é tempo perdido |
| Familiaridade do grupo | A janela é curta, e curva de aprendizado compete com entrega |
| Previsibilidade do provisionamento | O ambiente será criado e destruído várias vezes |

## Recomendação

**AWS Academy — Learner Lab.**

O critério de custo pessoal zero elimina de imediato as contas próprias de AWS, GCP e Azure: as três
exigem cartão, e a de AWS ainda teria custo real de control plane e NAT Gateway. Entre o que resta, o
Learner Lab cobre as cinco capacidades num provedor só, com o provider Terraform mais maduro e a
maior base de documentação — o que importa quando a janela de trabalho é curta.

A escolha custa caro em flexibilidade, e as consequências abaixo são reais. Mas todas são
contornáveis com trabalho, enquanto a ausência de cartão não é contornável com trabalho.

## Consequências

### Positivas

- Custo zero para o grupo, sem risco de fatura por esquecimento
- As cinco capacidades num provedor só, com um estado de Terraform coerente entre elas
- Provider maduro e amplamente documentado

### Negativas

- **Não é possível criar IAM roles ou policies.** Todo recurso que exige role assume `LabRole`. Isso
  invalida a maioria dos exemplos públicos de EKS com Terraform, que criam roles dedicadas — o código
  precisa referenciar a role existente por `data`, e copiar exemplo sem adaptar falha de formas
  confusas.
- **Credenciais expiram em ~4h e não há OIDC.** O pipeline usa credenciais estáticas em secrets, que
  precisam ser atualizadas a cada sessão. Mitigado por um script que atualiza os secrets dos quatro
  repositórios de uma vez.
- **Região fixa em `us-east-1`.**
- **DocumentDB indisponível.** Restringe as opções da RFC-002 na prática, ainda que não decida por
  ela.
- **O laboratório é encerrado ao fim da sessão.** O ambiente é efêmero por construção do provedor, o
  que combina com o ciclo de vida previsto mas elimina a possibilidade de manter algo no ar.

### Riscos aceitos

- O orçamento do laboratório é limitado. O dimensionamento precisa ser enxuto e o ambiente destruído
  após cada uso — um cluster esquecido de pé consome o crédito restante.
- Se o Learner Lab bloquear a criação de EKS ou de VPC Link, a arquitetura precisa ser repensada.
  Verificar isso é o primeiro passo do provisionamento, antes de qualquer outro trabalho de
  infraestrutura.
