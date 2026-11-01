import { randomUUID } from 'node:crypto';
import { defineFeature, loadFeature, DefineStepFunction } from 'jest-cucumber';
import { ServiceClient, customerBilling, expectStatus, staffClients } from './support/serviceClients';
import { waitFor } from './support/waitFor';

const feature = loadFeature('tests/e2e/service-order-journey.feature');

interface Execution { stage: string; status: string }
interface Budget { status: string; payment: { status: string; checkoutUrl: string } | null }

let os: ServiceClient;
let billing: ServiceClient;
let execution: ServiceClient;

/** What the scenario created, by the names the feature uses. */
let shop: { customerId: string; cpf: string; vehicleId: string; services: Map<string, string>; items: Map<string, string> };
let orderId: string;

beforeAll(async () => {
  ({ os, billing, execution } = await staffClients());
});

beforeEach(() => {
  shop = { customerId: '', cpf: '', vehicleId: '', services: new Map(), items: new Map() };
  orderId = '';
});

/** A valid CPF that no earlier run used, so the scenarios can run again on the same stack. */
function newCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const length of [9, 10]) {
    const sum = digits.slice(0, length).reduce((total, digit, i) => total + digit * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    digits.push(rest === 10 ? 0 : rest);
  }
  return digits.join('');
}

function newPlate(): string {
  return `TST${String(Math.floor(Math.random() * 10_000)).padStart(4, '0')}`;
}

async function openOrder(serviceName: string, quantity: number, itemName: string): Promise<void> {
  const created = await os.post<{ id: string; status: string }>('/service-orders', {
    customerId: shop.customerId,
    vehicleId: shop.vehicleId,
    serviceIds: [shop.services.get(serviceName)],
    items: [{ itemId: shop.items.get(itemName), quantity }],
  });
  orderId = expectStatus(created, 201, 'opening the order').id;
}

/** The mechanic takes the order from the queue once Execution has it, then finishes the stage. */
async function workStage(stage: 'DIAGNOSIS' | 'REPAIR'): Promise<void> {
  await waitFor(
    `the ${stage.toLowerCase()} in the mechanic's queue`,
    async () => (await execution.get<Execution>(`/executions/${orderId}`)).body,
    (current) => current.stage === stage && current.status === 'QUEUED',
  );
  expectStatus(await execution.post(`/executions/${orderId}/start`), 200, `starting the ${stage.toLowerCase()}`);
  expectStatus(await execution.post(`/executions/${orderId}/finish`), 200, `finishing the ${stage.toLowerCase()}`);
}

/** The customer approves at Billing, with the first four digits of the CPF as confirmation. */
async function approveBudget(): Promise<void> {
  await waitFor(
    'the budget at Billing',
    async () => (await billing.get<Budget>(`/service-orders/${orderId}/budget`)).body,
    (budget) => budget.status === 'PENDING_APPROVAL',
  );
  const decision = await customerBilling(shop.customerId, shop.cpf)
    .patch(`/service-orders/${orderId}/budget`, { status: 'APPROVED', code: shop.cpf.slice(0, 4) });
  expectStatus(decision, 200, 'approving the budget');
}

/** Plays the customer at the simulated provider once the charge exists. */
async function pay(outcome: 'approved' | 'rejected'): Promise<void> {
  await waitFor(
    'the charge at Billing',
    async () => (await billing.get<Budget>(`/service-orders/${orderId}/budget`)).body,
    (budget) => budget.payment?.status === 'PENDING',
  );
  expectStatus(await billing.post(`/payments/mock/${orderId}`, { status: outcome }), 200, `paying (${outcome})`);
}

function theShop(given: DefineStepFunction): void {
  given(/^the shop has a customer with a vehicle, the service "(.*)" and (\d+) "(.*)" in stock$/, async (serviceName: string, stock: string, itemName: string) => {
    shop.cpf = newCpf();
    const customer = await os.post<{ id: string }>('/customers', {
      name: 'E2E Customer', taxId: shop.cpf, taxType: 'CPF', email: `e2e-${randomUUID()}@example.com`, phone: '11999999999',
    });
    shop.customerId = expectStatus(customer, 201, 'registering the customer').id;

    const vehicle = await os.post<{ id: string }>('/vehicles', {
      customerId: shop.customerId, plate: newPlate(), brand: 'Fiat', model: 'Uno', year: 2018,
    });
    shop.vehicleId = expectStatus(vehicle, 201, 'registering the vehicle').id;

    const service = await os.post<{ id: string }>('/services', { name: `${serviceName} ${randomUUID()}`, price: 120, estimatedMinutes: 30 });
    shop.services.set(serviceName, expectStatus(service, 201, 'registering the service').id);

    const item = await os.post<{ id: string }>('/items', { name: `${itemName} ${randomUUID()}`, price: 30, stockQuantity: Number(stock) });
    shop.items.set(itemName, expectStatus(item, 201, 'registering the item').id);
  });
}

function theOrderEventuallyIs(then: DefineStepFunction): void {
  then(/^the OS service eventually shows the order as "(.*)"$/, async (status: string) => {
    await waitFor(
      `the order to be ${status} at the OS`,
      async () => (await os.get<{ status: string }>(`/service-orders/${orderId}`)).body,
      (order) => order.status === status,
    );
  });
}

defineFeature(feature, (test) => {
  test('A paid order is repaired', ({ given, when, then, and }) => {
    theShop(given);

    given(/^an attendant opened an order with "(.*)" and (\d+) "(.*)"$/, async (serviceName: string, quantity: string, itemName: string) => {
      await openOrder(serviceName, Number(quantity), itemName);
    });

    when('the order goes through diagnosis, customer approval, payment and repair', async () => {
      await workStage('DIAGNOSIS');
      await approveBudget();
      await pay('approved');
      await workStage('REPAIR');
    });

    theOrderEventuallyIs(then);

    and(/^billing shows the payment as "(.*)"$/, async (status: string) => {
      await waitFor(
        `the payment to be ${status} at Billing`,
        async () => (await billing.get<Budget>(`/service-orders/${orderId}/budget`)).body,
        (budget) => budget.payment?.status === status,
      );
    });

    and(/^execution shows the repair as "(.*)"$/, async (status: string) => {
      await waitFor(
        `the repair to be ${status} at Execution`,
        async () => (await execution.get<Execution>(`/executions/${orderId}`)).body,
        (current) => current.stage === 'REPAIR' && current.status === status,
      );
    });
  });

  test('A refused payment undoes the order', ({ given, when, then, and }) => {
    theShop(given);

    given('an order whose budget the customer approved', async () => {
      await openOrder('Oil change', 1, 'Oil filter');
      await workStage('DIAGNOSIS');
      await approveBudget();
    });

    when('the payment is refused', async () => {
      await pay('rejected');
    });

    theOrderEventuallyIs(then);

    and(/^"(.*)" has (\d+) reserved$/, async (itemName: string, reserved: string) => {
      await waitFor(
        `${reserved} "${itemName}" reserved`,
        async () => (await os.get<{ reservedQuantity: number }>(`/items/${shop.items.get(itemName)}`)).body,
        (item) => item.reservedQuantity === Number(reserved),
      );
    });

    and(/^billing shows the budget as "(.*)"$/, async (status: string) => {
      await waitFor(
        `the budget to be ${status} at Billing`,
        async () => (await billing.get<Budget>(`/service-orders/${orderId}/budget`)).body,
        (budget) => budget.status === status,
      );
    });

    and(/^execution shows the order as "(.*)"$/, async (status: string) => {
      await waitFor(
        `the order to be ${status} at Execution`,
        async () => (await execution.get<Execution>(`/executions/${orderId}`)).body,
        (current) => current.status === status,
      );
    });
  });
});
