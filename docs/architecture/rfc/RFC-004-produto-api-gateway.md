# RFC-004 (Escolha do produto de API Gateway)

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADRs derivados:** ADR-006

## Contexto

Esta RFC decide qual produto, não se deve haver um ponto único de entrada. A decisão de padrão é do
ADR-001. Separar as duas evita que trocar de produto obrigue a revisitar a arquitetura.

O tráfego externo tem dois destinos de naturezas diferentes. A aplicação roda em pods dentro do cluster
EKS. A Lambda de autenticação roda fora dele e não tem endereço no cluster. O gateway precisa alcançar os
dois e apresentá-los como uma API só.

## Alternativas avaliadas

### AWS API Gateway (HTTP API, v2)

A favor: integração nativa com AWS Lambda, via integração `AWS_PROXY`. Não consome recurso do cluster. Controle de vazão e
CORS já embutidos. Provisionado pelo mesmo código de infraestrutura do resto, sem chart nem recurso
customizado. Existe independente do estado do cluster, então recriar um não invalida o outro.

Contra: o VPC Link é um recurso a mais para criar e destruir, e o mais lento do conjunto. Um salto de
latência. Sem validação de requisição na borda. Preso à AWS.

### AWS API Gateway (REST API, v1)

A favor: tudo o que a versão HTTP oferece, mais validação de requisição, transformação de conteúdo, chaves
de API e planos de uso.

Contra: mais caro por requisição e configuração bem mais verbosa, para recursos que este sistema não usa.

### Kong Gateway (código aberto, rodando no cluster)

A favor: ecossistema maduro de plugins (rate limiting, validação de JWT, CORS). Configuração declarativa
por CRDs, versionada junto com o resto. Portável para qualquer nuvem, o que nenhuma opção gerenciada
oferece. O modo DB-less elimina a dependência de um PostgreSQL próprio para o gateway.

Contra: consome memória e CPU de um cluster dimensionado no limite. Para alcançar a Lambda precisa do
plugin `aws-lambda`, com credenciais AWS configuradas, e no AWS Academy essas credenciais expiram a cada
quatro horas. Ainda exige um Load Balancer público na frente. E soma mais um chart Helm e mais CRDs na
superfície de configuração.

### Traefik (no cluster)

A favor: leve, nativo de Kubernetes, configuração declarativa por `IngressRoute`. Excelente como ingress
controller.

Contra: sem integração nativa com Lambda. A função precisaria de uma Function URL própria, o que quebra o
ponto único de entrada que o ADR-001 estabelece. E também consome recurso do cluster.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Integração com a Lambda fora do cluster | É metade do tráfego que o gateway roteia |
| Consumo de recursos do cluster | O node group é pequeno, e a stack de observabilidade já ocupa boa parte |
| Custo de provisionamento e destruição | O ambiente sobe e desce várias vezes |
| Superfície de configuração | Quantos mecanismos distintos o time precisa aprender e versionar |
| Portabilidade | Quanto do desenho fica preso ao provedor |

## Recomendação

AWS API Gateway, na versão HTTP API.

O argumento que decide é a Lambda de autenticação. Ela vive fora do cluster e não tem endereço nele. Das
quatro alternativas, só as duas do API Gateway alcançam a Lambda sem inventar um caminho paralelo.

O Traefik obrigaria a expor a Lambda por Function URL, e aí existem dois endereços públicos, que é
justamente o que o ponto único de entrada existe para evitar. O Kong alcança pelo plugin `aws-lambda`,
mas com credenciais AWS que expiram a cada quatro horas no AWS Academy. Isso transformaria o caminho de
autenticação em algo que quebra sozinho no meio da demonstração.

O segundo argumento é capacidade. Kong e Traefik rodam como pods e competem por memória com a aplicação e
com a stack de observabilidade (Prometheus, Grafana, Loki e Tempo), num node group dimensionado no
limite. O API Gateway é gerenciado e tira esse consumo do orçamento de recursos do cluster.

Sobre HTTP API e não REST API: as capacidades exclusivas da v1 (validação de requisição e transformação
de conteúdo) duplicariam trabalho que a aplicação já faz, com validação de domínio na camada de
entidades. Pagar mais caro por requisição para duplicar responsabilidade é o pior dos dois mundos.

O contra mais sério é o acoplamento à AWS. O Kong seria genuinamente mais portável, e num cenário com
cluster folgado e sem Lambda no caminho de autenticação seria a escolha melhor. Aqui ele paga um custo
real em memória escassa para resolver pior o problema principal. A escolha é do contexto, não uma
afirmação de que o API Gateway seja superior ao Kong em geral.

## Consequências

Positivas:

- Lambda e aplicação atrás do mesmo host e do mesmo esquema de CORS
- Vazão controlada na borda, antes de qualquer recurso do cluster ser consumido
- O gateway não ocupa memória do cluster
- Ciclo de vida independente: recriar o cluster não invalida o gateway

Negativas:

- Acoplamento à AWS. Rotas, integrações e VPC Link são recursos específicos do provedor, e migrar
  exigiria reescrever essa camada inteira.
- Um salto de latência entre cliente e aplicação, e outro entre o API Gateway e a Lambda
- Depuração em dois lugares. Um erro pode nascer no API Gateway ou no pod, e o access log do stage
  precisa estar ligado para distinguir.
- Sem validação na borda, então requisição malformada consome recurso do cluster antes de ser recusada

Riscos aceitos:

- O VPC Link é o recurso mais lento a criar e destruir, e entra no orçamento de tempo do provisionamento.
- Confirmar o custo do VPC Link em `us-east-1` e se o AWS Academy permite criá-lo. Não vale afirmar
  valores sem checar a tabela vigente, porque uma RFC com número errado perde credibilidade inteira.
