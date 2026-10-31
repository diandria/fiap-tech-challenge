# ADR-015 (Comunicação entre serviços e contrato das mensagens)

- **Status:** Aceito
- **Data:** 2026-10-31

## Contexto

A saga do ADR-014 troca comandos e respostas entre OS, Billing e Execution. Essas mensagens são diferentes
das notificações do ADR-003 em três pontos que mudam a escolha do canal:

- **Perder uma mensagem trava uma ordem.** Uma notificação perdida é um e-mail a menos; um
  `PaymentConfirmed` perdido deixa uma ordem paga parada para sempre.
- **Duplicar uma mensagem pode cobrar ou baixar estoque duas vezes.** O ADR-003 aceitou duplicação de
  notificação e anotou, em "Quando revisitar", que isso deixaria de valer quando houvesse cobrança.
- **A ordem importa.** `RepairCompleted` processado antes de `RepairStarted` é recusado pela máquina de
  estados.

Há ainda o problema de gravar e publicar. Um serviço que grava no banco e depois publica na fila faz duas
escritas em sistemas diferentes. Se cair entre uma e outra, ou o banco mudou e ninguém soube, ou a mensagem
saiu para uma mudança que nunca foi gravada. Envolver as duas chamadas na mesma transação do banco não
resolve, porque a fila não participa dela.

## Alternativas

Para o canal da saga:

| Alternativa | A favor | Contra |
|---|---|---|
| SQS FIFO, uma fila de comandos por participante e uma fila única de respostas | Ordem garantida por grupo de mensagens, e o grupo pode ser a ordem de serviço. Deduplicação pelo id da mensagem. Fila de descarte nativa. Gerenciado, sem nada rodando no cluster. O layout (um canal de comando por participante, um de resposta) é o da orquestração. | Vazão menor que a fila padrão, irrelevante neste volume. Um grupo travado por uma mensagem com erro segura as mensagens seguintes da mesma ordem até ela ir para o descarte. |
| SQS padrão | Vazão praticamente ilimitada, mesmas garantias de durabilidade | Sem ordem e com entrega duplicada mais frequente. O consumidor precisaria reordenar ou recusar mensagens fora de hora e esperar a reentrega. |
| Tópico SNS com assinaturas por serviço | Já existe na plataforma; publicação desacoplada de quem consome | Publicação e assinatura servem a eventos para vários interessados. Comando tem um destinatário só, e a resposta precisa voltar para quem pediu. Sem fila na frente, não há reentrega controlada. |
| RabbitMQ dentro do cluster | Usado nas aulas, com filas, exchanges e confirmação de entrega maduros | Mais um componente com estado para operar e dimensionar num node group pequeno, num ambiente que é destruído e recriado a cada sessão |
| Kafka (MSK) | Log ordenado e reprocessável, ótimo para histórico de eventos | Custo e tempo de criação incompatíveis com o ambiente, e a saga não precisa de reprocessamento de histórico |
| REST síncrono entre os serviços | Simples de entender e depurar | Acopla no tempo: o OS só avança se Billing e Execution estiverem de pé naquele instante. A decisão do cliente e o pagamento acontecem minutos ou dias depois e não cabem numa chamada. |

Para publicar com segurança:

| Alternativa | A favor | Contra |
|---|---|---|
| Publicar logo depois de gravar | Nenhuma tabela nova | Duas escritas sem atomicidade; queda entre elas perde ou inventa mensagem |
| Transactional Outbox, com relay | A mensagem é gravada na mesma transação da mudança, e um relay publica depois. Nada se perde. | Uma tabela e um processo de publicação a mais. Entrega pelo menos uma vez, então o consumidor precisa ser idempotente. |
| Captura de mudanças do banco (CDC) | Publicação sem código de relay na aplicação | Infraestrutura nova para ler o log do banco, diferente para PostgreSQL e DynamoDB |

## Critérios de decisão

- **Garantia de entrega:** nenhuma mensagem da saga pode se perder.
- **Ordem por ordem de serviço** e **deduplicação**.
- **Atomicidade entre a mudança de estado e a mensagem que ela gera.**
- **Custo operacional** no ambiente que é recriado a cada sessão.
- **Acoplamento temporal:** um serviço fora do ar não pode derrubar os outros.

## Decisão

**Síncrono só na borda.** Cliente e funcionário falam com os serviços por REST, através do API Gateway. A
função de autenticação continua consultando o OS por REST para emitir o token. Entre os três serviços, não
há chamada HTTP: toda interação é mensagem.

**Canal.** Amazon SQS FIFO, com estas filas, cada uma com sua fila de descarte FIFO:

| Fila | Quem publica | Quem consome |
|---|---|---|
| `car-repair-shop-billing-commands.fifo` | OS | Billing |
| `car-repair-shop-execution-commands.fifo` | OS | Execution |
| `car-repair-shop-saga-replies.fifo` | Billing e Execution | OS |

Parâmetros: `MessageGroupId` igual ao id da ordem de serviço; `MessageDeduplicationId` igual ao `messageId`
do envelope; visibilidade de 30 segundos; espera longa de 20 segundos; cinco recebimentos antes do descarte.

**Publicação.** Transactional Outbox em cada serviço. A mensagem é gravada na mesma transação da mudança de
estado; um relay publica as pendentes em ordem e marca cada uma como publicada depois do envio. No DynamoDB
do Execution, a mudança e a mensagem vão numa única escrita transacional.

**Consumo.** Cada serviço registra o `messageId` de toda mensagem processada, na mesma transação do efeito.
Se o registro já existe, a mensagem é confirmada sem efeito. Mensagem que falha não é apagada: volta depois
da visibilidade e, no quinto recebimento, vai para a fila de descarte. Mensagem malformada segue o mesmo
caminho, para ficar disponível para inspeção.

**Filas de descarte.** As de comando são lidas pelo OS, que trata um comando que esgotou as tentativas como
falha da etapa (ADR-014). A de respostas não é lida automaticamente: o que cai nela é falha do próprio OS e
gera alerta.

**Rastreamento.** Todo envelope carrega o `traceparent` de quem publicou, e o consumidor continua o mesmo
trace, como o evento de notificação já faz (ADR-007, regra seis). Todo log e span de saga carrega também o id
da ordem de serviço, para que a mesma ordem possa ser seguida nos logs dos três serviços mesmo quando o
trace se divide, por exemplo entre o pedido do orçamento e a decisão do cliente, horas depois.

### Contrato

Declarado localmente em cada repositório; nenhum repositório importa código de outro, e este documento é o
acoplamento entre eles.

```ts
interface MessageEnvelope<TType extends string, TPayload> {
  messageId: string;      // uuid; chave de idempotência e de deduplicação
  type: TType;
  serviceOrderId: string; // uma saga por ordem; também é o grupo da fila
  occurredAt: string;     // ISO-8601
  traceparent?: string;   // W3C Trace Context
  payload: TPayload;
}

type CompensationReason = 'BUDGET_REJECTED' | 'PAYMENT_FAILED' | 'STEP_FAILED';

// Comandos para o Billing
interface GenerateBudget {
  customer: { id: string; name: string; email: string };
  lines: {
    kind: 'SERVICE' | 'ITEM';
    referenceId: string;
    description: string;
    unitPrice: number;
    quantity: number;
  }[];
}
interface RequestPayment {}
interface CancelBudget { reason: CompensationReason }

// Comandos para o Execution
interface EnqueueDiagnosis {}
interface EnqueueRepair { tasks: { serviceId: string; name: string }[] }
interface CancelExecution { reason: CompensationReason }

// Respostas para o OS
interface BudgetGenerated { budgetId: string; total: number }
interface BudgetApproved { budgetId: string }
interface BudgetRejected { budgetId: string }
interface PaymentConfirmed { paymentId: string; amount: number }
interface PaymentFailed { paymentId: string; reason: string }
interface BudgetCancelled {}
interface DiagnosisStarted {}
interface DiagnosisCompleted {}
interface RepairStarted {}
interface RepairCompleted {}
interface ExecutionCancelled {}
```

O comando de orçamento leva as linhas já precificadas e o contato do cliente. O Billing não consulta o
catálogo nem o cadastro do OS; ele recebe o retrato do momento do diagnóstico, do mesmo jeito que o evento
de notificação leva o que a função precisa.

### Extensão do evento de notificação

O contrato do ADR-003 ganha o tipo `PAYMENT_REQUESTED`, publicado pelo Billing depois de criar a cobrança,
com o campo `payment: { checkoutUrl: string }`. O Billing também passa a publicar o `BUDGET_READY`, que
antes saía do monolito. O OS continua publicando `SERVICE_ORDER_STATUS_CHANGED`. O ADR-003 continua valendo
para notificações, inclusive a aceitação de duplicação: notificação repetida é incômoda, não incorreta.

## Por que vence

FIFO por ordem de serviço resolve ordem e duplicação no próprio canal, e o que sobra (a reentrega depois de
uma falha no consumidor) é resolvido pelo registro de mensagens processadas, na mesma transação do efeito.
Com fila padrão, a mesma garantia exigiria reordenação no consumidor. Com RabbitMQ ou Kafka, as garantias
existem, mas o preço é operar um componente com estado num ambiente recriado a cada sessão.

O outbox é a única das três formas de publicar que torna a mudança de estado e a mensagem atômicas sem
infraestrutura nova. A entrega pelo menos uma vez que ele produz é exatamente o que o consumidor idempotente
absorve.

Manter REST só na borda deixa cada serviço disponível independentemente dos outros. Se o Execution cai, a
abertura de ordens continua; os pedidos de diagnóstico esperam na fila e são atendidos quando ele volta.

## Consequências

### Positivas

- Nenhuma mensagem da saga se perde, e nenhuma produz efeito duas vezes
- Ordem garantida por ordem de serviço
- Um serviço fora do ar atrasa o fluxo, mas não derruba os outros nem perde trabalho
- O trace e o id da ordem permitem seguir uma ordem pelos três serviços

### Negativas

- Uma tabela de outbox, uma de mensagens processadas e um relay em cada serviço
- Uma mensagem com erro segura o grupo da mesma ordem por até cinco tentativas antes do descarte
- Dois modelos de erro convivem: resposta HTTP na borda e mensagem na fila de descarte entre serviços
- A consistência entre os serviços é eventual

### Riscos aceitos

- A janela de deduplicação do FIFO é de cinco minutos; depois dela, a deduplicação depende só do registro
  de mensagens processadas, que é permanente no PostgreSQL e expira em 30 dias no DynamoDB

## Quando revisitar

Se o volume ultrapassar a vazão do FIFO, se surgir um consumidor que precise reprocessar o histórico de
eventos, ou se a plataforma ganhar um broker gerenciado que já esteja de pé por outro motivo.
