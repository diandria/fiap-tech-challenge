# ADR-014 (Saga orquestrada da ordem de serviço)

- **Status:** Aceito
- **Data:** 2026-10-31

## Contexto

Com a divisão do ADR-013, abrir uma ordem, orçar, aprovar, cobrar e executar passam a envolver três
serviços, cada um com o próprio banco. A transação única que o monolito fazia deixa de existir: o OS
consegue garantir a abertura e a reserva de estoque numa transação local, mas não consegue garantir, na
mesma transação, que o Billing gerou o orçamento ou que o pagamento foi aprovado.

Tentar de novo não resolve tudo. Parte das falhas é de negócio, não de infraestrutura: o cliente rejeita o
orçamento, o cartão é recusado. Nesses casos, o que já foi feito em outros serviços precisa ser desfeito por
uma operação explícita. É o problema que a Saga resolve: uma sequência de transações locais, coordenadas
por mensagens, em que cada etapa que pode precisar ser desfeita tem uma transação de compensação.

Uma saga garante atomicidade, consistência e durabilidade, mas não isolamento. Duas sagas sobre a mesma
ordem, ou uma saga e uma requisição comum, podem ver dados intermediários uma da outra. O desenho precisa
tratar isso de forma explícita.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Saga orquestrada, com o orquestrador dentro do OS | Toda a sequência e todas as compensações ficam num lugar só, legível e testável. As mensagens vão num sentido (orquestrador para participante, resposta de volta), sem dependência cíclica. Os participantes não sabem que fazem parte de uma saga. O estado da saga é o próprio status da ordem, que já é persistido no OS. | O orquestrador concentra regra e cresce. Se o OS para, nenhuma saga avança, embora nenhuma se perca (as mensagens esperam na fila). |
| Saga orquestrada, num serviço só de coordenação | Mesma legibilidade, e o OS fica só com a ordem | Um quarto serviço que precisa ler e gravar o status da ordem, que é dado do OS. Ou ele duplica esse estado, ou consulta o OS a cada passo; nos dois casos, mais acoplamento e mais um ponto de falha. |
| Saga coreografada, por eventos | Nenhum ponto central. Cada serviço reage aos eventos dos outros e pode ser implantado sem coordenação. | A sequência não está escrita em lugar nenhum: para entender o fluxo, é preciso ler os três serviços. OS e Execution passam a assinar os eventos um do outro, o que cria ciclo. Cada participante precisa de um evento de desfazer próprio. |
| Transação distribuída (two-phase commit, XA) | Atomicidade e isolamento reais, como no monolito | Exige que banco relacional, DynamoDB e fila participem do mesmo protocolo, o que não acontece. Bloqueia recursos enquanto espera, e a espera aqui inclui a decisão do cliente, que pode levar dias. |

## Critérios de decisão

- **Legibilidade do fluxo:** em quantos lugares é preciso olhar para entender o caminho de uma ordem.
- **Acoplamento entre serviços:** quem precisa conhecer quem, e se surgem ciclos.
- **Tratamento de falha:** onde fica a decisão de compensar e quão fácil é verificar que ela está certa.
- **Ponto único de falha:** o que acontece quando o coordenador fica fora do ar.
- **Aderência à espera longa:** o fluxo inclui decisão humana e pagamento, que não cabem numa transação
  aberta.

## Decisão

Saga orquestrada, com o orquestrador no OS Service. O OS envia comandos para uma fila de cada participante
e recebe todas as respostas numa fila única (ADR-015).

### Etapas e compensações

| # | Participante | Transação local | Compensação | Disparada por | Responde |
|---|---|---|---|---|---|
| T1 | OS | Abre a ordem em `RECEIVED` e reserva o estoque | Libera a reserva e encerra a ordem | Abertura pelo atendente | Emite `EnqueueDiagnosis` |
| T2 | Execution | Enfileira o diagnóstico; o mecânico inicia e conclui | Encerra a entrada da fila (`CancelExecution`) | `EnqueueDiagnosis` | `DiagnosisStarted`, `DiagnosisCompleted` |
| T3 | Billing | Gera o orçamento e avisa o cliente | Cancela o orçamento (`CancelBudget`) | `GenerateBudget` | `BudgetGenerated` |
| T4 | Billing | Registra a decisão do cliente | A rejeição dispara a compensação de T1 e T2 | Decisão do cliente | `BudgetApproved`, `BudgetRejected` |
| T5 | Billing | Cria a cobrança e confirma o pagamento | A recusa dispara a compensação de T1 a T3 | `RequestPayment` | `PaymentConfirmed`, `PaymentFailed` |
| T6 | OS | Baixa o estoque reservado e marca `PAID` | Nenhuma: retentável | `PaymentConfirmed` | Emite `EnqueueRepair` |
| T7 | Execution | Enfileira o reparo; o mecânico inicia, acompanha cada serviço e conclui | Nenhuma: retentável | `EnqueueRepair` | `RepairStarted`, `RepairCompleted` |
| T8 | OS | Marca `FINISHED`; a entrega continua sendo feita pelo funcionário | — | `RepairCompleted` | — |

O pagamento confirmado é o ponto de não retorno. Antes dele, toda etapa tem compensação; depois dele, não
há o que desfazer, só o que terminar, e as etapas são retentadas até concluir. A expressão usual para esse
ponto, transação pivô, vem de Chris Richardson (*Microservices Patterns*).

### Máquina de estados da ordem

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → PAID → EXECUTION → FINISHED → DELIVERED
                              │               │
                              ▼               ▼
                          REJECTED        CANCELLED
```

`RECEIVED` e `WAITING_APPROVAL` também podem ir para `CANCELLED`, quando uma etapa falha de forma
definitiva (abaixo).

### Como o orquestrador reage

Cada linha é uma única transação local no OS: status, histórico, estoque, registro da mensagem processada e
comandos de saída, juntos.

| Resposta | Status esperado | Efeito no OS | Comandos emitidos |
|---|---|---|---|
| `DiagnosisStarted` | `RECEIVED` | → `DIAGNOSIS` | — |
| `DiagnosisCompleted` | `DIAGNOSIS` | → `WAITING_APPROVAL` | `GenerateBudget` |
| `BudgetGenerated` | `WAITING_APPROVAL` | Grava o total do orçamento | — |
| `BudgetApproved` | `WAITING_APPROVAL` | → `APPROVED` | `RequestPayment` |
| `BudgetRejected` | `WAITING_APPROVAL` | Libera as reservas, → `REJECTED` | `CancelExecution` |
| `PaymentConfirmed` | `APPROVED` | Baixa o estoque reservado, → `PAID` | `EnqueueRepair` |
| `PaymentFailed` | `APPROVED` | Libera as reservas, → `CANCELLED` | `CancelExecution`, `CancelBudget` |
| `RepairStarted` | `PAID` | → `EXECUTION` | — |
| `RepairCompleted` | `EXECUTION` | → `FINISHED` | — |
| `ExecutionCancelled`, `BudgetCancelled` | `REJECTED` ou `CANCELLED` | Nenhum, além de registrar | — |

### Falha de etapa

Nem toda falha pede compensação. Um participante fora do ar não é falha de etapa: o comando espera na fila
e a saga continua quando ele volta. Uma exceção passageira também não: o participante recebe a mensagem de
novo e tenta outra vez.

Vira falha de etapa o comando que o participante recebeu e não conseguiu processar cinco vezes, e que foi
para a fila de descarte. O OS lê as filas de descarte dos comandos que enviou e decide:

| Comando que falhou | Status esperado | Efeito no OS | Comandos emitidos |
|---|---|---|---|
| `EnqueueDiagnosis` | `RECEIVED` | Libera as reservas, → `CANCELLED` | — |
| `GenerateBudget` | `WAITING_APPROVAL` | Libera as reservas, → `CANCELLED` | `CancelExecution` |
| `RequestPayment` | `APPROVED` | Libera as reservas, → `CANCELLED` | `CancelExecution`, `CancelBudget` |
| `EnqueueRepair` | `PAID` | Nenhum; registra o erro e alerta | — |
| `CancelExecution`, `CancelBudget` | qualquer | Nenhum; registra o erro e alerta | — |

Registrar e alertar é tratamento de erro, não compensação. Compensa-se o que deixou trabalho de outra etapa
pela metade. Um comando de compensação que falha não dispara outra compensação, porque isso poderia entrar
em laço; ele precisa de alguém olhando.

### Falta de isolamento

- **Atualização perdida no orçamento.** Enquanto o Billing calcula, um item adicionado à ordem ficaria fora
  do orçamento. Por isso a ordem vai para `WAITING_APPROVAL` já no `DiagnosisCompleted`, antes de o
  orçamento existir: adicionar e remover itens só é permitido em `DIAGNOSIS`, e a janela fecha.
- **Reler o valor.** Antes de aplicar cada resposta, o orquestrador relê a ordem e confere se ela está no
  status esperado; a gravação usa controle otimista de versão, e uma mudança concorrente faz a transação
  falhar e a mensagem ser reprocessada com o dado novo.
- **Resposta fora de hora.** Resposta que chega com a ordem em outro status é descartada e contada. Com
  fila ordenada por ordem de serviço, isso só acontece com mensagem repetida.
- **Corrida na reserva.** A reserva de estoque é feita com uma atualização condicional no banco, que nunca
  deixa o reservado passar do disponível, mesmo com aberturas simultâneas.

### Limitações registradas

- Não há prazo para o cliente aprovar ou pagar. Uma ordem pode ficar em `WAITING_APPROVAL` ou `APPROVED`
  indefinidamente, segurando a reserva de estoque.
- A primeira recusa de pagamento encerra a ordem. O cliente não tenta outro cartão na mesma ordem.

## Por que vence

Pela legibilidade e pelo tratamento de falha. O fluxo tem três participantes, uma espera humana, um
pagamento e compensações em cascata. Com coreografia, a pergunta "o que acontece quando o pagamento é
recusado?" teria a resposta espalhada por três repositórios, cada um reagindo a eventos dos outros. Com
orquestração, a resposta é uma linha de tabela num único arquivo, e o teste que a prova também. A regra de
seleção de Richardson vai na mesma direção: coreografia para sagas simples, orquestração para as demais.

Pelo acoplamento. Na orquestração, Billing e Execution só conhecem a própria fila de comandos e a fila de
respostas; não sabem da existência um do outro nem da saga. Na coreografia, o OS teria de assinar eventos
do Execution e o Execution eventos do OS, o ciclo que se quer evitar.

Pelo lugar do orquestrador. O estado da saga é o status da ordem, e quem é dono da ordem é o OS. Um
orquestrador em serviço próprio teria de duplicar esse estado ou perguntar por ele a cada passo. Dentro do
OS, a decisão e o dado que ela consulta moram na mesma transação.

O custo assumido é o ponto central. Se o OS estiver fora do ar, nenhuma saga avança; mas nenhuma se perde,
porque as respostas esperam na fila e o estado está persistido. O risco de o orquestrador acumular regra
demais é controlado por uma regra de desenho: o orquestrador decide a sequência, e a regra de cada etapa
continua no participante dono dela.

## Consequências

### Positivas

- O fluxo completo e suas compensações ficam escritos num lugar só
- Participantes simples, sem conhecimento da saga, testáveis isoladamente
- Toda compensação é atômica com a mudança de status que a motivou, porque as duas saem na mesma transação
  local
- O estado de cada saga é consultável a qualquer momento pelo status e pelo histórico da ordem

### Negativas

- O OS é ponto central do fluxo: fora do ar, nenhuma ordem avança
- A consistência entre os serviços é eventual: por alguns instantes, o OS pode mostrar um status que o
  Billing ou o Execution ainda não refletem
- Reserva de estoque presa em ordens que nunca recebem decisão do cliente

### Riscos aceitos

- Sem prazo de aprovação e pagamento. Em produção, isso exigiria expiração com compensação automática.
- Falha de uma compensação depende de intervenção humana, avisada por alerta.

## Quando revisitar

Se o fluxo ganhar ramificações que dependam de várias respostas ao mesmo tempo, se o orquestrador começar a
acumular regra de negócio dos participantes, ou se reservas presas em ordens paradas virarem problema de
estoque.
