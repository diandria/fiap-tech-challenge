# ADR-001 (Ponto único de entrada)

- **Status:** Aceito
- **Data:** 2026-08-28
- **RFC de origem:** RFC-001

## Contexto

Este ADR decide o padrão, não o produto. Qual gateway usar (AWS API Gateway, Kong ou Traefik) é assunto
da RFC-004 e do ADR-006. Separar as duas decisões evita que trocar de produto obrigue a revisitar a
arquitetura.

O tráfego externo tem destinos com naturezas diferentes. A aplicação roda em pods no cluster EKS, e a
Lambda de autenticação roda fora dele. Sem um ponto único de entrada, cada um precisa da própria
exposição pública, do próprio CORS e da própria política de throttling.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Sem ponto único: Load Balancer público para o cluster e Function URL para a Lambda | Menor latência, menos um recurso, depuração direta no destino | O cliente precisa conhecer dois endereços e saber qual serve o quê. Throttling e CORS configurados em dois lugares acabam divergindo. A superfície pública cresce a cada componente novo. |
| Ponto único dentro do cluster (ingress controller, como nginx ou Traefik) | Roteamento junto do workload, familiar a quem opera Kubernetes | Só alcança o que está no cluster. A Lambda precisaria de Function URL própria, e o ponto único deixa de ser único. O cluster mantém exposição pública direta. |
| Ponto único gerenciado, fora do cluster (API Gateway) | Um endereço para o cliente, qualquer que seja o destino. Throttling e CORS num lugar só. O cluster deixa de ter exposição pública. Existe independente do estado do cluster. | Um salto de latência. Mais um recurso no ciclo de provisionamento. Depuração exige olhar dois lugares. |

## Decisão

Ponto único de entrada gerenciado, fora do cluster. O Network Load Balancer do cluster é interno e só
alcançável a partir do gateway, por VPC Link.

Decisão de rede derivada: usar a VPC default da conta AWS. Isso evita o custo de um NAT Gateway e o
acoplamento de estado que uma VPC própria criaria entre os repositórios de infraestrutura.

## Por que vence

É a única alternativa em que "onde o código roda" é detalhe de roteamento, invisível para quem consome.
Nas outras duas, o cliente precisa saber que autenticação e negócio moram em lugares diferentes. Essa
informação vaza para o front-end, para a coleção de testes e para qualquer integração futura. Um endereço
que muda quando a implementação muda não é contrato.

Vale um peso a mais pensando na decomposição futura. Hoje há dois destinos. Com os contextos separados em
serviços próprios, serão cinco ou seis. O ponto único é o que permite extrair um contexto sem que nenhum
consumidor perceba: muda-se a rota no gateway e o endereço público continua o mesmo. Sem ele, cada
extração quebraria contrato com todo mundo que consome a API.

Dito isso, a decisão já se paga com dois destinos. A decomposição amplifica o ganho, não o cria.

## Consequências

Positivas:

- Throttling e CORS centralizados no API Gateway
- A rota `POST /auth/cpf` é servida pela Lambda e as demais pelo cluster, de forma transparente
- O cluster deixa de ter exposição pública direta

Negativas:

- Mais um salto de latência
- Um recurso a mais para provisionar e destruir a cada ciclo do ambiente
- Depuração menos direta, porque é preciso olhar os logs do API Gateway e do pod

Risco aceito:

- A disponibilidade do sistema inteiro passa a depender do API Gateway. É aceitável, porque é um serviço
  gerenciado com disponibilidade maior que a do cluster EKS que ele fronteia.

## Quando revisitar

Se o sistema passar a ter um destino só (por exemplo, se a autenticação voltar para dentro da aplicação),
o ponto único perde o argumento principal e vira um salto de latência sem contrapartida.
