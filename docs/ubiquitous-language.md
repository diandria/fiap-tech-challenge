# Ubiquitous Language — Car Repair Shop

Domain terms from the car repair shop and their counterparts in code. Reference for communication between business and engineering.

> Visual diagrams in `docs/ddd/`: Event Storming, Pictographic Language, Ubiquitous Language.

---

## Domain Terms

| Term (business) | Definition | Code counterpart |
|---|---|---|
| **Customer** | Individual or company that requests and approves the service | `Customer` — entity with `taxId` (CPF or CNPJ) |
| **Vehicle** | Customer asset that will be serviced at the shop | `Vehicle` — linked to a `Customer` by `customerId` |
| **Service Order (OS)** | Central record that tracks the whole job from intake to delivery | `ServiceOrder` — main aggregate of the system |
| **Diagnosis** | Technical analysis of the vehicle, performed by the mechanic, to identify what needs to be done | `DIAGNOSIS` phase of the OS; transitions `DIAGNOSIS` and `WAITING_APPROVAL` via `PATCH /service-orders/:id` |
| **Service** | Technical activity performed on the vehicle (e.g., oil change, alignment) | `Service` — catalog entity with `name`, `price`, `estimatedMinutes` |
| **Item** | Physical part or supply used to perform a service | `Item` — entity with stock control (`stockQuantity`, `reservedQuantity`) |
| **Inventory** | Set of items available at the shop; tracked by available and reserved quantities | `stockQuantity` and `reservedQuantity` fields on the `Item` entity |
| **Budget** | Total amount computed from services and items in the OS; sent to the customer for approval | `budgetTotal` — computed on the `DIAGNOSIS → WAITING_APPROVAL` transition, stored as a fixed value |
| **Approval** | Customer's decision to authorize the service execution after receiving the budget | Body `{ status: "APPROVED", code }` on `PATCH /service-orders/:id`; transition `WAITING_APPROVAL → APPROVED` |
| **Rejection** | Customer's decision to decline the budget | Body `{ status: "REJECTED", code }` on `PATCH /service-orders/:id`; transition `WAITING_APPROVAL → REJECTED` |
| **Execution** | Phase during which services are being performed by the mechanic | `EXECUTION` status; entered via `{ status: "EXECUTION" }` |
| **Delivery** | Returning the vehicle to the customer after services are done | `DELIVERED` status; entered via `{ status: "DELIVERED" }` |

---

## Actors

| Actor (business) | Definition | System role |
|---|---|---|
| **Attendant** | Front desk: customer/vehicle registration, opening OS | `attendant` |
| **Mechanic** | Technical execution: diagnosis, services/items, execution, delivery | `mechanic` |
| **Admin** | Full access; manages users, service catalog, and inventory | `admin` |
| **Customer** | Reads OS status and approves/rejects the budget through a verification code | public (no JWT) |

---

## Technical Domain Concepts

| Concept | Definition |
|---|---|
| **Approval code** | First 4 digits of the customer's CPF or CNPJ. Used to authenticate budget approval/rejection without login. E.g., CPF `529.982.247-25` → code `5299` |
| **Stock reservation** | Quantity of an item set aside for a specific OS but not yet consumed. Incremented when the item is added to the OS; decremented when execution starts (consumption) or the budget is rejected (release) |
| **Frozen price** | `budgetTotal` is computed and stored at the `DIAGNOSIS → WAITING_APPROVAL` transition. Later changes to the service or item catalog do not affect a budget that was already generated |
| **Soft delete** | Customers are not physically removed; they receive `deletedAt`. Preserves history of linked OS |
| **taxId** | CPF (11 digits) or CNPJ (14 digits) stored as digits only, no formatting. `taxType` indicates which one |

---

## Service Order Status

| Status (code) | Business name | Description |
|---|---|---|
| `RECEIVED` | Received | OS opened; vehicle awaiting diagnosis |
| `DIAGNOSIS` | In diagnosis | Mechanic assessing the vehicle; adding services and items |
| `WAITING_APPROVAL` | Waiting for approval | Budget generated and sent; awaiting customer decision |
| `APPROVED` | Approved | Customer authorized; awaiting start of execution |
| `EXECUTION` | In execution | Services being performed |
| `FINISHED` | Finished | All services completed; awaiting delivery |
| `DELIVERED` | Delivered | Vehicle returned to customer (terminal status) |
| `REJECTED` | Rejected | Customer did not approve the budget (terminal status) |

---

## Known Discrepancies

| Item | DDD diagram | Current code | Decision |
|---|---|---|---|
| Who runs diagnosis (start/finish) | Mechanic (Pictographic Language) | `mechanic` and `admin` | Fixed in `feat/os-status-body` — diagnosis transitions require `mechanic` or `admin` |
| Sending the budget to the customer | Explicit command in Event Storming | No active push mechanism; customer reads it through the public endpoint | MVP decision — no external notification channel |
