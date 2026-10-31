import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Application } from 'express';
import { defineFeature, loadFeature, DefineStepFunction } from 'jest-cucumber';
import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { FailedCommandHandler } from '../../src/adapters/messaging/FailedCommandHandler';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';
import { FakeParticipants } from './support/FakeParticipants';

const feature = loadFeature('tests/bdd/service-order-saga.feature');

let app: Application;
let participants: FakeParticipants;
let staff: { Authorization: string };

/** What the scenario created, by the names the feature uses. */
let shop: { customerId: string; vehicleId: string; services: Map<string, string>; items: Map<string, string> };
let orderId: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'saga-scenarios-secret';
  await connectTestDB();
  app = createTestApp();
  staff = { Authorization: `Bearer ${jwt.sign({ type: 'staff', userId: 'u-1', role: 'admin' }, process.env.JWT_SECRET)}` };

  const saga = new ServiceOrderSaga(
    new PrismaUnitOfWork(prisma, { currentTraceparent: () => undefined }),
    new PostgresServiceRepository(prisma),
    new PostgresCustomerRepository(prisma),
    { execute: async () => undefined },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  participants = new FakeParticipants(prisma, saga, new FailedCommandHandler(saga));
});

afterAll(async () => { await disconnectTestDB(); });

beforeEach(() => {
  shop = { customerId: '', vehicleId: '', services: new Map(), items: new Map() };
  orderId = '';
});

afterEach(async () => { await clearTestDB(); });

async function post(path: string, body: object): Promise<{ id: string }> {
  const res = await request(app).post(path).set(staff).send(body);
  if (res.status !== 201) throw new Error(`POST ${path} answered ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

function theShop(given: DefineStepFunction, and: DefineStepFunction): void {
  given('a customer with a vehicle', async () => {
    const customer = await post('/customers', {
      name: 'Maria Souza', taxId: '529.982.247-25', taxType: 'CPF', email: 'maria@example.com', phone: '11999999999',
    });
    const vehicle = await post('/vehicles', { customerId: customer.id, plate: 'ABC-1234', brand: 'Fiat', model: 'Uno', year: 2018 });
    shop.customerId = customer.id;
    shop.vehicleId = vehicle.id;
  });

  and(/^a catalog service "(.*)" priced at (.*)$/, async (name: string, price: string) => {
    const service = await post('/services', { name, price: Number(price), estimatedMinutes: 30 });
    shop.services.set(name, service.id);
  });

  and(/^an item "(.*)" priced at (.*) with (\d+) units in stock$/, async (name: string, price: string, stock: string) => {
    const item = await post('/items', { name, price: Number(price), stockQuantity: Number(stock) });
    shop.items.set(name, item.id);
  });
}

/** The attendant opens the order, the mechanic diagnoses it and the Billing Service prices it. */
async function orderWaitingForApproval(quantity: number, itemName: string): Promise<void> {
  const order = await post('/service-orders', {
    customerId: shop.customerId,
    vehicleId: shop.vehicleId,
    services: [...shop.services.values()],
    items: [{ itemId: shop.items.get(itemName), quantity }],
  });
  orderId = order.id;
  await participants.diagnose(orderId);
  await participants.generateBudget(orderId);
}

function anOrderWaitingForApproval(given: DefineStepFunction): void {
  given(/^an order waiting for approval with (\d+) "(.*)" reserved$/, async (quantity: string, itemName: string) => {
    await orderWaitingForApproval(Number(quantity), itemName);
  });
}

function theOrderIs(then: DefineStepFunction): void {
  then(/^the order is "(.*)"$/, async (status: string) => {
    const res = await request(app).get(`/service-orders/${orderId}`).set(staff);
    expect(res.body.status).toBe(status);
  });
}

function itemHasReserved(and: DefineStepFunction): void {
  and(/^"(.*)" has (\d+) reserved$/, async (itemName: string, reserved: string) => {
    const res = await request(app).get(`/items/${shop.items.get(itemName)}`).set(staff);
    expect(res.body.reservedQuantity).toBe(Number(reserved));
  });
}

function participantWasAsked(and: DefineStepFunction, step: string, command: string, reason: string): void {
  and(step, async () => {
    const commands = await participants.commandsFor(orderId, command);
    expect(commands.map((sent) => sent.payload)).toEqual([{ reason }]);
  });
}

defineFeature(feature, (test) => {
  test('Customer rejects the budget', ({ given, and, when, then }) => {
    theShop(given, and);
    anOrderWaitingForApproval(given);

    when('the customer rejects the budget', async () => {
      await participants.customerDecides(orderId, 'BudgetRejected');
    });

    theOrderIs(then);
    itemHasReserved(and);
    participantWasAsked(and, 'execution was asked to cancel the order', 'CancelExecution', 'BUDGET_REJECTED');
  });

  test('Payment is refused', ({ given, and, when, then }) => {
    theShop(given, and);

    given(/^an approved order with (\d+) "(.*)" reserved$/, async (quantity: string, itemName: string) => {
      await orderWaitingForApproval(Number(quantity), itemName);
      await participants.customerDecides(orderId, 'BudgetApproved');
    });

    when('the payment is refused', async () => {
      await participants.refusePayment(orderId);
    });

    theOrderIs(then);
    itemHasReserved(and);
    participantWasAsked(and, 'execution was asked to cancel the order', 'CancelExecution', 'PAYMENT_FAILED');
    participantWasAsked(and, 'billing was asked to cancel the budget', 'CancelBudget', 'PAYMENT_FAILED');
  });

  test('Budget generation keeps failing', ({ given, and, when, then }) => {
    theShop(given, and);
    anOrderWaitingForApproval(given);

    when('the budget request exhausts its retries', async () => {
      await participants.exhaustRetries(orderId, 'GenerateBudget');
    });

    theOrderIs(then);
    itemHasReserved(and);
    participantWasAsked(and, 'execution was asked to cancel the order', 'CancelExecution', 'STEP_FAILED');
  });
});
