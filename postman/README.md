# Postman Collection — Car Repair Shop API

Postman collection with the full end-to-end API flow: authentication, master data, OS lifecycle (diagnosis → budget → approval → execution → delivery), budget rejection, statistics, and error scenarios (401/403/400/404).

## Files

- `car-repair-shop.postman_collection.json` — v2.1.0 collection with all calls organized in numbered folders.
- `car-repair-shop.postman_environment.json` — environment for **local / Docker Compose** (`baseUrl = http://localhost:3000`).
- `car-repair-shop-k8s.postman_environment.json` — environment for **Kubernetes / Minikube** (`baseUrl = http://localhost:8080`). See setup below.

## Environments

| File | Target | `baseUrl` |
|------|--------|-----------|
| `car-repair-shop.postman_environment.json` | Local / Docker Compose | `http://localhost:3000` |
| `car-repair-shop-k8s.postman_environment.json` | Kubernetes / Minikube | `http://localhost:8080` |

All other variables (credentials, persisted IDs) are identical between environments — only `baseUrl` differs.

## Prerequisites

### Local / Docker Compose

1. API running at `http://localhost:3000` via `docker compose up`.
2. MongoDB running per `.env`.
3. Admin seed executed. Default credentials:
   - `adminEmail`: `admin@master.com`
   - `adminPassword`: `change-me-in-production`
   Update them to match `ADMIN_PASSWORD` in your `.env`.

### Kubernetes / Minikube

The service is type `LoadBalancer` on port `8080`. On WSL2 with Minikube Docker driver, run `minikube tunnel` once in a separate terminal to bind `localhost:8080`:

```bash
minikube tunnel
```

Keep that terminal open. Then:

1. Manifests applied: `kubectl apply -k k8s/`
2. Service accessible at `http://localhost:8080`
3. The admin seed runs automatically on container start when `SEED_ON_START=true` is set in the cluster ConfigMap/Secret.

## Import

In Postman: **Import → Upload Files** and select the collection plus the desired environment file. Then pick the matching environment from the selector at the top right.

## Execution order (flow)

Run the folders in numbered order. Each request persists what subsequent ones need (token, IDs) into the environment. Use **Collection Runner** or run them manually in sequence.

| # | Folder | What it does |
|---|--------|--------------|
| 00 | Setup | Admin login, attendant/mechanic registration (idempotent: accepts 201 or 409), login for both roles |
| 01 | Catalog (admin) | Creates a service (Oil Change, R$ 120) and an item (5W30 Oil, R$ 40, stock 10) |
| 02 | Customer and Vehicle (attendant) | Creates a customer with CPF (`96627075300`, first 4 digits = approval code `9662`) and a vehicle `ABC-1234` (idempotent: 409 reuses the existing record) |
| 03 | OS Happy Path | Full lifecycle: create OS → diagnosis → add service + item (qty 2) → finish diagnosis (`budgetTotal = 200`) → public status read → approve with code `9662` → execution → delivery |
| 04 | Rejection | Second OS rejected after the budget — verifies the item returns to stock |
| 05 | Stats and Listings | `avg-execution`, services catalog avg-time (`/services/avg-time`), filters by `status` and `customerId`, detail by ID |
| 06 | Error Scenarios | 401 (wrong password, no token), 403 (wrong role), 400 (invalid CPF/plate, wrong code, invalid transition), 404 |
| 07 | OS Item/Service Removal (mechanic) | Creates a third OS, demos `DELETE /service-orders/:id/services/:serviceId` and `DELETE /service-orders/:id/items/:itemId` (releases stock) |
| 08 | Maintenance (PUT/DELETE entities) | Creates temporary customer/vehicle/service/item, exercises every PUT and DELETE for catalog and customer/vehicle resources |

## Persisted variables (set automatically)

`adminToken`, `attendantToken`, `mechanicToken`, `attendantId`, `mechanicId`, `customerId`, `customerTaxId`, `customerCode`, `vehicleId`, `serviceId`, `itemId`, `osId`, `osRejectId`, `osRemovalId`, `tempCustomerId`, `tempVehicleId`, `tempServiceId`, `tempItemId`.

## Business rules covered by the flow

- Customer approval code = first 4 digits of the CPF/CNPJ.
- OS state machine: `RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED` (with `REJECTED` branch from `WAITING_APPROVAL`).
- Internal OS transitions go through `PATCH /service-orders/:id` with `{ status }` (mechanic+admin).
- Customer budget approval/rejection goes through `PATCH /service-orders/:id/budget` with `{ status: "APPROVED" | "REJECTED", code }` (public, rate-limited).
- Per-service transitions go through `PATCH /service-orders/:id/services/:serviceId` with `{ status: "IN_PROGRESS" | "COMPLETED" }`.
- Budget total = services + (item.price × quantity).
- Role authorization: attendant (customers/vehicles/create OS), mechanic (diagnosis/execution/transitions), admin (catalog).
- On the `DIAGNOSIS → WAITING_APPROVAL` transition the server fires a customer notification through `INotificationService`. In the MVP the adapter is a `console.log` mock — the API response is unchanged; check the server stdout for `[NOTIFICATION] Email sent to ...`.

## Run via CLI (Newman)

Local:
```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Kubernetes (replace `192.168.49.2` with `minikube ip` output):
```bash
# Update baseUrl first
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop-k8s.postman_environment.json \
  --env-var "baseUrl=http://$(minikube ip):30080"
```
