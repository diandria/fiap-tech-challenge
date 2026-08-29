# RFC-005 (Produtos da stack de observabilidade)

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADR relacionado:** ADR-005 (abordagem)

## Contexto

Esta RFC decide quais produtos, não qual abordagem. A escolha entre auto-hospedar e contratar Datadog ou
New Relic é do ADR-005. Aqui se escolhe o que compõe a stack auto-hospedada.

As opções não são independentes. Alguns produtos se integram melhor entre si, e integração ruim aparece
como "não consigo pular do log para o trace".

## Alternativas, por sinal

### Métricas

| Alternativa | A favor | Contra |
|---|---|---|
| Prometheus | Padrão de fato em Kubernetes. Modelo de dados alinhado ao ambiente. Descobre alvo novo com um `ServiceMonitor`. | Consumo de memória cresce com a cardinalidade das séries |
| VictoriaMetrics | Mais eficiente em memória que o Prometheus, com PromQL compatível | Comunidade menor, e menos exemplos quando algo dá errado |
| InfluxDB | Bom para séries de alta frequência | Modelo de dados distinto do Prometheus, menos alinhado a Kubernetes, e integração menos direta com o ecossistema |

### Registros

| Alternativa | A favor | Contra |
|---|---|---|
| Loki | Indexa apenas labels e guarda o resto comprimido, então cabe em ambiente pequeno. Integração nativa com o Grafana. | Busca full-text bem mais fraca que a do Elasticsearch |
| Elasticsearch ou OpenSearch | Busca full-text muito superior, e agregações ricas | Pede vários GB de heap para operar com folga, o que é incompatível com o node group disponível |

### Rastros

| Alternativa | A favor | Contra |
|---|---|---|
| Grafana Tempo | Ligação direta com Loki e Prometheus na mesma interface, via derived fields | Projeto mais novo que o Jaeger |
| Jaeger ou Zipkin | Mais maduros, com interface própria completa | A ligação com Loki e Prometheus é indireta, e o salto entre sinais vira copiar o `trace_id` e colar noutra aba |

### Visualização

| Alternativa | A favor | Contra |
|---|---|---|
| Grafana | Consulta métricas, logs e traces nativamente, e os dashboards são JSON versionável | Dashboards construídos do zero |
| Kibana | Boa para exploração de logs | Não consulta métricas nem traces, e está presa ao Elasticsearch, já descartado por consumo de memória |

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Navegação entre sinais numa interface só | É o que transforma três ferramentas numa experiência de investigação |
| Pegada de memória | O ambiente é pequeno, e a observabilidade compete com a aplicação |
| Integração entre os componentes | Integração ruim aparece como salto manual entre abas |
| Portabilidade e padrão aberto | Um serviço futuro em outra linguagem precisa entrar sem adaptação |

## Recomendação

Prometheus para métricas, Loki para logs, Tempo para traces e Grafana como interface única. Na prática,
o chart `kube-prometheus-stack` (que já traz Prometheus, Alertmanager, Grafana, `kube-state-metrics` e
`node-exporter`), mais os charts de Loki com Promtail e de Tempo.

O critério que amarra tudo é a navegação entre sinais. Os quatro precisam ser vistos num painel só, com
salto de um para outro. O Grafana é o único que consulta os três tipos nativamente, e Loki e Tempo foram
desenhados para integrar com ele: o derived field que leva de um log ao trace que o originou é
configuração de datasource, não código.

Montar Elasticsearch para logs e Jaeger para traces daria ferramentas individualmente mais capazes e uma
experiência de investigação pior, porque cada salto entre sinais viraria copiar o `trace_id` e colar
noutra aba.

O segundo critério é memória. O Elasticsearch pede vários GB de heap para operar com folga, e o node group
não tem. O Loki indexa apenas labels e guarda o resto comprimido, e foi projetado exatamente para esse
compromisso: busca full-text mais fraca em troca de operar em ambiente pequeno.

O contra a registrar é que o Loki é claramente inferior ao Elasticsearch para investigação exploratória em
texto livre. Procurar uma mensagem de erro que você não sabe descrever é onde ele decepciona. A mitigação
é de disciplina, não de ferramenta: log estruturado com campos consultáveis (ADR-010) reduz a necessidade
de busca full-text, porque quase toda pergunta vira filtro por label.

## Consequências

Positivas:

- Métricas, logs e traces no Grafana, com navegação entre eles
- Pegada compatível com o dimensionamento disponível
- Todos agnósticos de linguagem e consumindo OpenMetrics e OTLP, então um serviço novo aparece nos mesmos
  dashboards sem adaptação
- Alvo novo é descoberto com um `ServiceMonitor`, sem custo por serviço

Negativas:

- Busca full-text no Loki é fraca
- Dashboards do Grafana e regras de alerta construídos do zero
- Quatro componentes para provisionar e manter, em vez de um agente único

Risco aceito:

- A soma das pegadas dos quatro precisa caber no ambiente com folga para a aplicação. A conta vem antes da
  instalação, e é refeita depois dela com o consumo real.
