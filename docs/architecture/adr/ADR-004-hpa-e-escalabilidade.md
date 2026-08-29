# ADR-004 (HorizontalPodAutoscaler e escalabilidade)

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

A carga da oficina não é uniforme. A abertura de ordens de serviço concentra no início do expediente, e o
processamento de orçamento gera picos curtos. Dimensionar para o pico desperdiça recurso o dia inteiro.
Dimensionar para a média derruba o serviço no pico.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Réplicas fixas dimensionadas para o pico | Previsível, sem componente a mais | Paga o pico o tempo todo. E o pico é uma estimativa que vai estar errada. |
| Escala manual por operador | Controle total | Depende de alguém acordado no momento certo, o que é inviável numa oficina sem time de plantão |
| HorizontalPodAutoscaler por CPU | Reage sozinho em cerca de 30 segundos. Os `resources.requests` já são necessários por outros motivos. Nativo do Kubernetes, sem operador extra. | CPU é indicador imperfeito de carga. Escala pods, não nós, então o teto real é a capacidade do node group. |
| HorizontalPodAutoscaler por métrica customizada (RPS ou latência) | Mede o que importa de verdade | Exige o `prometheus-adapter`, que é mais uma peça para operar e falhar |

## Decisão

HorizontalPodAutoscaler sobre uso de CPU, com um PodDisruptionBudget garantindo mínimo de réplicas
durante operações voluntárias, como dreno de nó.

Parâmetros: `minReplicas: 2` e alvo de 70% de CPU. O `maxReplicas` precisa bater com a capacidade real do
node group, e essa conta é feita antes do provisionamento, não depois.

## Por que vence

Neste sistema, CPU é um indicador honesto. O trabalho por requisição é dominado por serialização JSON e
espera do PostgreSQL, e o consumo cresce junto com o volume. O ganho de precisão da métrica customizada
não paga o custo de operar o `prometheus-adapter`, e um componente a mais na stack é um componente a mais
que pode quebrar na hora errada.

Pensando na decomposição futura, escalar de forma independente é uma das razões que justificam separar
serviços, e o HorizontalPodAutoscaler por Deployment é o mecanismo que entrega isso. Hoje há um Deployment
só e o ganho é modesto. Com os contextos separados, cada um escala pelo próprio perfil: ordens de serviço
sob carga de atendimento, catálogo praticamente estável. Adotar agora significa que a decomposição herda o
mecanismo pronto.

Ressalva honesta: se a decomposição nunca vier, o mecanismo continua se pagando pelo perfil irregular da
própria oficina.

## Consequências

Positivas:

- Reação automática a picos, sem intervenção
- Os `resources.requests`, necessários para o HPA, também melhoram o agendamento dos pods pelo scheduler
- O PodDisruptionBudget evita indisponibilidade durante dreno de nó

Negativas:

- CPU não captura carga dominada por espera de rede ou de banco
- O HPA age sobre pods, não sobre nós, então o teto real é o que couber no node group provisionado
- Requer `resources.requests` declarado e o `metrics-server` instalado. Sem qualquer um dos dois, o HPA
  fica em `unknown` e não escala, sem erro visível.

Risco aceito:

- Não vai haver Cluster Autoscaler, então o teto de réplicas é limitado pelo node group fixo. Um
  `maxReplicas` que promete mais do que cabe aparece como falha, com pods em `Pending`. Por isso a conta de
  capacidade vem antes do provisionamento.

## Quando revisitar

Se a carga passar a ser dominada por espera (muitas chamadas a serviços externos, por exemplo), CPU deixa
de ser indicador honesto, e a métrica customizada passa a valer o `prometheus-adapter` que ela custa.
