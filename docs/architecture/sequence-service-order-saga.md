# Diagramas de sequência (saga da ordem de serviço)

Nível de serviço. As regras de cada etapa estão no [ADR-014](adr/ADR-014-saga-orquestrada.md), e o
contrato das mensagens no [ADR-015](adr/ADR-015-comunicacao-e-contrato-de-mensagens.md). Toda chamada HTTP
passa pelo API Gateway, que fica fora dos diagramas para não repetir uma seta em cada passo.

Setas cheias são chamadas HTTP; setas abertas são mensagens nas filas. As notas marcam onde acontece cada
transação local e qual mensagem ela grava no outbox, porque é isso que garante que a mudança de estado e a
mensagem saem juntas.

## 1. Caminho feliz: da abertura à entrega

```mermaid
sequenceDiagram
    actor A as Atendente
    actor M as Mecânico
    actor C as Cliente
    participant OS as OS Service
    participant EX as Execution Service
    participant BI as Billing Service
    participant MP as Mercado Pago

    A->>OS: POST /service-orders
    Note over OS: transação local: ordem RECEIVED,<br/>reserva de estoque, EnqueueDiagnosis no outbox
    OS-)EX: EnqueueDiagnosis

    M->>EX: POST /executions/{id}/start
    EX-)OS: DiagnosisStarted
    Note over OS: RECEIVED → DIAGNOSIS
    M->>OS: ajusta serviços e peças da ordem
    M->>EX: POST /executions/{id}/finish
    EX-)OS: DiagnosisCompleted
    Note over OS: DIAGNOSIS → WAITING_APPROVAL,<br/>GenerateBudget no outbox

    OS-)BI: GenerateBudget (linhas precificadas e contato)
    Note over BI: grava o orçamento,<br/>BudgetGenerated no outbox
    BI-)OS: BudgetGenerated
    Note over OS: grava o total do orçamento

    C->>BI: PATCH /service-orders/{id}/budget (APPROVED)
    BI-)OS: BudgetApproved
    Note over OS: WAITING_APPROVAL → APPROVED,<br/>RequestPayment no outbox
    OS-)BI: RequestPayment
    BI->>MP: cria a preferência
    MP-->>BI: link de pagamento
    C->>MP: paga
    MP->>BI: notificação assinada
    BI->>MP: consulta o pagamento
    MP-->>BI: approved
    BI-)OS: PaymentConfirmed
    Note over OS: baixa o estoque reservado, APPROVED → PAID,<br/>EnqueueRepair no outbox

    OS-)EX: EnqueueRepair (serviços da ordem)
    M->>EX: POST /executions/{id}/start
    EX-)OS: RepairStarted
    Note over OS: PAID → EXECUTION
    M->>EX: andamento de cada serviço e finish
    EX-)OS: RepairCompleted
    Note over OS: EXECUTION → FINISHED

    A->>OS: PATCH /service-orders/{id} (DELIVERED)
```

## 2. Orçamento rejeitado

A ordem já tem estoque reservado e uma entrada encerrada de diagnóstico no Execution. A rejeição desfaz as
duas coisas.

```mermaid
sequenceDiagram
    actor C as Cliente
    participant OS as OS Service
    participant EX as Execution Service
    participant BI as Billing Service

    C->>BI: PATCH /service-orders/{id}/budget (REJECTED)
    Note over BI: orçamento REJECTED,<br/>BudgetRejected no outbox
    BI-)OS: BudgetRejected
    Note over OS: compensação local: libera as reservas,<br/>WAITING_APPROVAL → REJECTED,<br/>CancelExecution no outbox
    OS-)EX: CancelExecution
    Note over EX: encerra a entrada da fila
    EX-)OS: ExecutionCancelled
```

## 3. Pagamento recusado

A recusa chega antes do ponto de não retorno, então tudo o que foi feito até ali é desfeito: reserva de
estoque, entrada da fila e orçamento.

```mermaid
sequenceDiagram
    participant OS as OS Service
    participant EX as Execution Service
    participant BI as Billing Service
    participant MP as Mercado Pago

    MP->>BI: notificação assinada
    BI->>MP: consulta o pagamento
    MP-->>BI: rejected
    Note over BI: pagamento REJECTED,<br/>PaymentFailed no outbox
    BI-)OS: PaymentFailed
    Note over OS: compensação local: libera as reservas,<br/>APPROVED → CANCELLED,<br/>CancelExecution e CancelBudget no outbox
    OS-)EX: CancelExecution
    OS-)BI: CancelBudget
    EX-)OS: ExecutionCancelled
    BI-)OS: BudgetCancelled
```

## 4. Etapa que esgota as tentativas

O Billing recebe o pedido de orçamento e não consegue processá-lo. Depois do quinto recebimento, a fila
move a mensagem para a fila de descarte, e o OS trata isso como falha da etapa.

```mermaid
sequenceDiagram
    participant OS as OS Service
    participant Q as Fila de comandos do Billing
    participant BI as Billing Service
    participant D as Fila de descarte
    participant EX as Execution Service

    OS-)Q: GenerateBudget
    loop cinco recebimentos
        Q-)BI: GenerateBudget
        Note over BI: falha ao processar;<br/>a mensagem não é confirmada
    end
    Q-)D: move a mensagem
    D-)OS: GenerateBudget que falhou
    Note over OS: compensação local: libera as reservas,<br/>WAITING_APPROVAL → CANCELLED,<br/>CancelExecution no outbox
    OS-)EX: CancelExecution
    EX-)OS: ExecutionCancelled
```

Um participante fora do ar não aparece aqui: nesse caso, os comandos só esperam na fila e a saga continua
quando ele volta, sem compensação.

Depois do pagamento confirmado não há o que compensar. Se o `EnqueueRepair`, ou um comando de
compensação, esgota as tentativas, o OS não muda a ordem: registra o erro com a mensagem inteira, conta
em `saga_stuck_total` e o alerta `SagaStepStuck` chama alguém.
