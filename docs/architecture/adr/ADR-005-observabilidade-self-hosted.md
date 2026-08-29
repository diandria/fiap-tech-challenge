# ADR-005 (Observabilidade auto-hospedada)

- **Status:** Aceito
- **Data:** 2026-08-28
- **RFC derivada:** RFC-005 (escolha dos produtos)

## Contexto

O sistema precisa mostrar latência das APIs, consumo de recursos, saúde das unidades de execução,
registros correlacionados e rastros distribuídos. A escolha é entre entregar a coleta a um serviço
gerenciado externo ou operá-la dentro do próprio cluster.

Este ADR decide a abordagem. Quais produtos usar dentro dela é assunto da RFC-005.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Datadog | A melhor integração com Kubernetes do mercado. Painéis prontos e correlação automática entre sinais. | Trial de 14 dias, com risco concreto de expirar antes da entrega. Dados de operação saem do ambiente. Chave de licença pessoal no CI. Depois do trial, custo por host. |
| New Relic | Free tier permanente e generoso (100 GB por mês). Agente Node.js maduro, com APM, infraestrutura e logs num lugar só. | Mesma saída de dados para terceiro. A instrumentação fica presa ao agente do fornecedor. A conta pessoal de alguém vira dependência do projeto. |
| Prometheus, Grafana, Loki e Tempo, auto-hospedados no cluster | Provisionados pelo mesmo Terraform do cluster. Sobem e descem junto com o ambiente. Retenção e cardinalidade sob controle total. Instrumentação em OpenMetrics e OTLP, portável para qualquer backend. | Painéis e alertas construídos do zero. Consomem recursos do próprio cluster que se quer medir. Os dados morrem com o cluster. |

## Decisão

Stack aberta auto-hospedada no cluster (Prometheus, Grafana, Loki e Tempo), provisionada junto com ele
via `kube-prometheus-stack` e charts Helm.

## Por que vence

Quatro argumentos, em ordem de peso.

O primeiro é coerência com infraestrutura como código. A observabilidade sobe pelo mesmo `terraform apply`
que cria o cluster. Com Datadog ou New Relic, boa parte da configuração de monitoramento vive num painel
web que ninguém versiona, e some quando a conta expira. Num sistema cujo provisionamento inteiro é
Terraform, deixar a observabilidade fora dele é a incoerência que cobra caro na primeira vez que o
ambiente precisa ser recriado do zero.

O segundo é o ciclo de vida acoplado ao ambiente. O ambiente é efêmero. Uma stack que nasce e morre com
ele não deixa resíduo, não acumula custo entre sessões e não depende de conta externa seguir ativa.

O terceiro é a instrumentação portável. A aplicação expõe métricas em OpenMetrics (via `prom-client`) e
rastros em OTLP (via OpenTelemetry). Trocar de backend depois é mudar o endereço do coletor, não
reinstrumentar o código. Com o agente do Datadog ou do New Relic, a instrumentação vira refém do
fornecedor.

O quarto aparece na decomposição futura. Datadog e New Relic cobram por host ou por agente, e o custo de
observar cresce junto com o número de serviços, exatamente quando observar passa a ser mais necessário. O
Prometheus absorve um alvo novo com um `ServiceMonitor`, e o padrão aberto significa que um serviço
escrito em Go ou Java entra na mesma stack sem negociação.

O contra mais sério é que construir painel do zero dá mais trabalho que instalar um agente. É verdade, e
é trabalho real. O que compensa é que painel como código é versionado, revisado em PR e sobrevive à
destruição do cluster, enquanto o painel montado na interface do fornecedor se perde junto com a conta.

## De onde vem cada sinal

Descrição da capacidade técnica da stack, não lista de requisitos:

| Sinal | Origem |
|---|---|
| Latência das APIs | Histograma `http_request_duration_seconds`, exposto pela aplicação e raspado pelo Prometheus |
| CPU e memória do cluster | `kube-state-metrics` e `node-exporter`, que vêm com o `kube-prometheus-stack` |
| Saúde e disponibilidade | Métrica `up` dos alvos e `kube_pod_status_ready` |
| Alertas | Regras `PrometheusRule` avaliadas sobre as séries acima, e entregues pelo Alertmanager |
| Logs correlacionados | Promtail lê o stdout dos contêineres e envia ao Loki, promovendo campos do JSON a labels |
| Rastros | Exportação OTLP da aplicação para o Tempo |

## Consequências

Positivas:

- Observabilidade versionada e recriável junto com o ambiente
- Sem custo, sem conta externa, sem chave pessoal no pipeline
- Retenção e cardinalidade sob controle direto

Negativas:

- Os dados morrem com o cluster, então não há histórico entre sessões
- Painéis do Grafana e regras de alerta construídos do zero
- A stack consome recursos do cluster que ela mesma monitora, e em ambiente pequeno isso compete com a
  aplicação
- O Alertmanager fica sem canal externo configurado, então os alertas são visíveis apenas na interface

Risco aceito:

- Em ambiente pequeno, a própria observabilidade pode ser o que falta de memória para a aplicação. A conta
  de capacidade vem antes da instalação.

## Quando revisitar

Se o ambiente deixar de ser efêmero e passar a exigir histórico de longo prazo. Aí o argumento do ciclo de
vida acoplado se inverte, e o New Relic, que retém sem custo de disco local, volta à mesa.
