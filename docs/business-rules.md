# Business Rules

## Service Order Lifecycle

A Service Order (OS) progresses through a strict state machine. Only the transitions listed below are valid; any other transition throws a `ValidationError`.

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED
```

| From              | To                  | Trigger                              |
|-------------------|---------------------|--------------------------------------|
| RECEIVED          | DIAGNOSIS           | Mechanic starts diagnosis            |
| DIAGNOSIS         | WAITING_APPROVAL    | Mechanic finishes diagnosis (budget computed) |
| WAITING_APPROVAL  | APPROVED            | Customer approves with confirmation code |
| WAITING_APPROVAL  | REJECTED            | Customer rejects the budget          |
| APPROVED          | EXECUTION           | Mechanic starts execution            |
| EXECUTION         | FINISHED            | Mechanic finishes all services       |
| FINISHED          | DELIVERED           | Attendant records vehicle delivery   |

`DELIVERED` and `REJECTED` are terminal states — no further transitions are allowed.

## Budget Calculation

Budget is computed when the OS transitions from `DIAGNOSIS` to `WAITING_APPROVAL` (`FinishDiagnosisUseCase`):

```
budgetTotal = Σ service.price  +  Σ (item.price × osItem.quantity)
```

The result is stored on the OS and sent to the customer via notification. It is not recalculated after `WAITING_APPROVAL`.

## Stock Management

Items carry two counters:

| Field              | Meaning                                      |
|--------------------|----------------------------------------------|
| `stockQuantity`    | Total physical units in stock                |
| `reservedQuantity` | Units reserved by open service orders        |

Available stock = `stockQuantity − reservedQuantity`.

**Reservation rules:**
- An item can only be added to an OS during `DIAGNOSIS`.
- `AddItemToOSUseCase` checks available stock before reserving; throws `ValidationError` if insufficient.
- `reservedQuantity` is incremented on addition and decremented on removal (`RemoveItemFromOSUseCase`).

## Notifications

Notifications are best-effort and never block the main flow:

| Event                | Use Case               | Method                  |
|----------------------|------------------------|-------------------------|
| Status changed       | `NotifyStatusChangeUseCase` | `notifyStatusChanged`  |
| Budget ready         | `NotifyBudgetUseCase`  | `notifyBudgetReady`     |

Both use cases wrap the notification call in a `try/catch` and log errors without propagating them. The current implementation (`ConsoleNotificationService`) writes to `stdout`; the port (`INotificationService`) allows swapping to email or another channel.

## Customer Approval Code

When a customer approves the budget, they must supply a confirmation code stored on the `Customer` entity. The code is verified by `ApproveBudgetUseCase` before the OS moves to `APPROVED`. An invalid code throws `ValidationError`.

## Service Timing

Services within an OS track their own start and finish timestamps (`OSService.startedAt`, `OSService.finishedAt`) via `StartServiceUseCase` and `FinishServiceUseCase`. These are independent from the OS-level timestamps (`startedAt`, `finishedAt`, `deliveredAt`).
