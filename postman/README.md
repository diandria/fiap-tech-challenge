# Postman Collection — Car Repair Shop API

Postman collection with the full end-to-end API flow: authentication, master data, OS lifecycle (diagnosis → budget → approval → execution → delivery), budget rejection, statistics, and error scenarios (401/403/400/404).

## Files

- `car-repair-shop.postman_collection.json` — v2.1.0 collection with all calls organized in numbered folders.
- `car-repair-shop.postman_environment.json` — environment with `baseUrl`, credentials, and variables persisted between requests (tokens, IDs).

## Prerequisites

1. API running locally at `http://localhost:3000` (adjust `baseUrl` in the environment if needed).
2. MongoDB running per `.env`.
3. Admin seed executed. Default environment credentials are:
   - `adminEmail`: `admin@master.com`
   - `adminPassword`: `change-me-in-production`
   Update them in the environment to match the `ADMIN_PASSWORD` configured in your server's `.env`.

## Import

In Postman: **Import → Upload Files** and select both files. Then pick the **Car Repair Shop — Local** environment from the selector at the top right.

## Execution order (flow)

Run the folders in numbered order. Each request persists what subsequent ones need (token, IDs) into the environment. Use **Collection Runner** or run them manually in sequence.

| # | Folder | What it does |
|---|--------|--------------|
| 00 | Setup | Admin login, attendant/mechanic registration (idempotent: accepts 201 or 409), login for both roles |
| 01 | Catalog (admin) | Creates a service (Oil Change, R$ 120) and an item (5W30 Oil, R$ 40, stock 10) |
| 02 | Customer and Vehicle (attendant) | Creates a customer with CPF (`52998224725`, first 4 digits = approval code `5299`) and a vehicle `ABC-1234` |
| 03 | OS Happy Path | Full lifecycle: create OS → diagnosis → add service + item (qty 2) → finish diagnosis (`budgetTotal = 200`) → public status read → approve with code `5299` → execution → delivery |
| 04 | Rejection | Second OS rejected after the budget — verifies the item returns to stock |
| 05 | Stats and Listings | `avg-execution`, filters by `status` and `customerId`, detail by ID |
| 06 | Error Scenarios | 401 (wrong password, no token), 403 (wrong role), 400 (invalid CPF/plate, wrong code, invalid transition), 404 |

## Persisted variables (set automatically)

`adminToken`, `attendantToken`, `mechanicToken`, `attendantId`, `mechanicId`, `customerId`, `customerTaxId`, `customerCode`, `vehicleId`, `serviceId`, `itemId`, `osId`, `osRejectId`.

## Business rules covered by the flow

- Customer approval code = first 4 digits of the CPF/CNPJ.
- OS state machine: `RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED` (with `REJECTED` branch from `WAITING_APPROVAL`).
- Internal OS transitions go through `PATCH /service-orders/:id` with `{ status }` (mechanic+admin).
- Customer budget approval/rejection goes through `PATCH /service-orders/:id/budget` with `{ status: "APPROVED" | "REJECTED", code }` (public, rate-limited).
- Per-service transitions go through `PATCH /service-orders/:id/services/:serviceId` with `{ status: "IN_PROGRESS" | "COMPLETED" }`.
- Budget total = services + (item.price × quantity).
- Role authorization: attendant (customers/vehicles/create OS), mechanic (diagnosis/execution/transitions), admin (catalog).

## Run via CLI (Newman)

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```
