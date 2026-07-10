# Regras de Negócio

## Ciclo de Vida da Ordem de Serviço

A OS percorre uma máquina de estados estrita. Apenas as transições listadas abaixo são válidas; qualquer outra lança `ValidationError`.

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED
```

| De                | Para                | Gatilho                                              |
|-------------------|---------------------|------------------------------------------------------|
| RECEIVED          | DIAGNOSIS           | Mecânico inicia o diagnóstico                        |
| DIAGNOSIS         | WAITING_APPROVAL    | Mecânico encerra o diagnóstico (orçamento calculado) |
| WAITING_APPROVAL  | APPROVED            | Cliente aprova com código de confirmação             |
| WAITING_APPROVAL  | REJECTED            | Cliente rejeita o orçamento                          |
| APPROVED          | EXECUTION           | Mecânico inicia a execução                           |
| EXECUTION         | FINISHED            | Mecânico finaliza todos os serviços                  |
| FINISHED          | DELIVERED           | Atendente registra a entrega do veículo              |

`DELIVERED` e `REJECTED` são estados terminais — nenhuma transição adicional é permitida.

## Cálculo do Orçamento

O orçamento é calculado quando a OS transita de `DIAGNOSIS` para `WAITING_APPROVAL` (`FinishDiagnosisUseCase`):

```
budgetTotal = Σ service.price  +  Σ (item.price × osItem.quantity)
```

O resultado é armazenado na OS e enviado ao cliente via notificação. Não é recalculado após `WAITING_APPROVAL`.

## Gestão de Estoque

Os itens possuem dois contadores:

| Campo              | Significado                                         |
|--------------------|-----------------------------------------------------|
| `stockQuantity`    | Total de unidades físicas em estoque                |
| `reservedQuantity` | Unidades reservadas por ordens de serviço em aberto |

Estoque disponível = `stockQuantity − reservedQuantity`.

**Regras de reserva:**
- Um item só pode ser adicionado a uma OS durante o estado `DIAGNOSIS`.
- `AddItemToOSUseCase` verifica o estoque disponível antes de reservar; lança `ValidationError` se insuficiente.
- `reservedQuantity` é incrementado na adição e decrementado na remoção (`RemoveItemFromOSUseCase`).
- Na transição `APPROVED → EXECUTION`, `stockQuantity` é decrementado e `reservedQuantity` zerado.
- Na transição `WAITING_APPROVAL → REJECTED`, `reservedQuantity` é decrementado para todos os itens da OS.

## Notificações

Notificações são best-effort e nunca bloqueiam o fluxo principal:

| Evento           | Use Case                    | Interface               |
|------------------|-----------------------------|-------------------------|
| Status alterado  | `NotifyStatusChangeUseCase` | `IStatusChangeNotifier` |
| Orçamento pronto | `NotifyBudgetUseCase`       | `IBudgetNotifier`       |

Ambos os use cases envolvem a chamada em `try/catch` e registram erros sem propagá-los. A implementação atual (`ConsoleNotificationService`) escreve em `stdout`; as interfaces permitem substituição por e-mail ou outro canal sem alterar o domínio.

## Código de Aprovação do Cliente

Ao aprovar ou rejeitar o orçamento, o cliente deve fornecer um código de confirmação. O código não é armazenado como campo dedicado — é derivado em tempo de execução como os primeiros 4 caracteres do `customer.taxId` pela função `verifyCustomerCode` em `use-cases/utils/serviceOrderUtils.ts`. Um código inválido lança `ValidationError`.

## Temporização dos Serviços

Os serviços dentro de uma OS rastreiam seus próprios timestamps de início e fim (`OSService.startedAt`, `OSService.finishedAt`) via `StartServiceUseCase` e `FinishServiceUseCase`. Esses timestamps são independentes dos timestamps da OS (`startedAt`, `finishedAt`, `deliveredAt`).
