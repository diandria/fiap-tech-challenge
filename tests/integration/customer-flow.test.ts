import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Application } from 'express';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { PostgresUserRepository } from '../../src/adapters/gateways/PostgresUserRepository';
import { RegisterUseCase } from '../../src/use-cases/auth/RegisterUseCase';

const JWT_SECRET = 'customer-flow-secret';
const INTERNAL_TOKEN = 'customer-flow-internal-token';
const CPF = '52998224725';
const CODE = '5299';

let app: Application;
let adminToken: string;
let mechanicToken: string;

/**
 * Reproduz o que a function faz depois do lookup: assina o JWT de cliente com o
 * mesmo segredo da aplicacao, no formato da RFC-003.
 *
 * Esta duplicacao e proposital. O teste nao importa o codigo da function --
 * ela vive em outro repositorio --, entao ele verifica o *contrato*: se os dois
 * lados divergirem, este teste quebra, que e exatamente o sinal que se quer.
 */
function signCustomerToken(customerId: string, name: string): string {
  return jwt.sign(
    { type: 'customer', sub: customerId, cpf: CPF, name },
    JWT_SECRET,
    { expiresIn: '1h', issuer: 'car-repair-shop-auth' },
  );
}

async function seedStaffTokens(): Promise<void> {
  const register = new RegisterUseCase(new PostgresUserRepository(prisma));
  await register.execute({ email: 'admin@flow.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'mech@flow.com', password: 'mechpass', role: 'mechanic' });
  adminToken = (await request(app).post('/auth/login').send({ email: 'admin@flow.com', password: 'adminpass' })).body.token;
  mechanicToken = (await request(app).post('/auth/login').send({ email: 'mech@flow.com', password: 'mechpass' })).body.token;
}

/** Abre uma OS e a leva ate WAITING_APPROVAL, que e onde o cliente entra. */
async function osWaitingApproval(customerId: string): Promise<string> {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const veh = await request(app).post('/vehicles').set(auth)
    .send({ customerId, plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 });
  const svc = await request(app).post('/services').set(auth)
    .send({ name: 'Oil Change', price: 80, estimatedMinutes: 30 });
  const itm = await request(app).post('/items').set(auth)
    .send({ name: 'Oil Filter', price: 25, stockQuantity: 10 });

  const os = await request(app).post('/service-orders').set(auth).send({
    customerId, vehicleId: veh.body.id,
    serviceIds: [svc.body.id], items: [{ itemId: itm.body.id, quantity: 1 }],
  });

  const mech = { Authorization: `Bearer ${mechanicToken}` };
  await request(app).patch(`/service-orders/${os.body.id}`).set(mech).send({ status: 'DIAGNOSIS' });
  await request(app).patch(`/service-orders/${os.body.id}`).set(mech).send({ status: 'WAITING_APPROVAL' });
  return os.body.id;
}

async function createCustomer(name = 'John', taxId = CPF, email = 'j@t.com'): Promise<string> {
  const res = await request(app).post('/customers').set({ Authorization: `Bearer ${adminToken}` })
    .send({ name, taxId, taxType: 'CPF', email, phone: '11999999999' });
  return res.body.id;
}

describe('Customer authentication flow', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.INTERNAL_TOKEN = INTERNAL_TOKEN;
    await connectTestDB();
    app = createTestApp();
    await seedStaffTokens();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE service_order_items, service_order_services, service_orders,
                     vehicles, customers, items, services
      RESTART IDENTITY CASCADE
    `);
  });

  // O cenario que atravessa o sistema inteiro: e o unico que provaria que o
  // lookup, o formato do token e as duas rotas concordam entre si.
  it('should complete the whole flow GIVEN a registered customer WHEN authenticating by cpf', async () => {
    const customerId = await createCustomer();
    const osId = await osWaitingApproval(customerId);

    // 1. A function consulta o cliente pelo endpoint interno.
    const lookup = await request(app).post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN).send({ cpf: CPF });

    expect(lookup.status).toBe(200);
    expect(lookup.body).toEqual({ id: customerId, name: 'John', active: true });

    // 2. A function emite o token com o mesmo segredo da aplicacao.
    const token = signCustomerToken(lookup.body.id, lookup.body.name);

    // 3. O cliente consulta a propria OS.
    const status = await request(app).get(`/service-orders/${osId}/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(status.status).toBe(200);
    expect(status.body.status).toBe('WAITING_APPROVAL');

    // 4. E aprova o orcamento.
    const approve = await request(app).patch(`/service-orders/${osId}/budget`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'APPROVED', code: CODE });

    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('APPROVED');
  });

  it('should return 403 GIVEN another customer token WHEN reading the order', async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer('Mary', '11144477735', 'm@t.com');
    const osId = await osWaitingApproval(owner);

    const res = await request(app).get(`/service-orders/${osId}/status`)
      .set('Authorization', `Bearer ${signCustomerToken(intruder, 'Mary')}`);

    expect(res.status).toBe(403);
  });

  // O par que prova a protecao: o 403 acompanhado da ausencia de efeito.
  it('should keep the status GIVEN another customer approves WHEN deciding the budget', async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer('Mary', '11144477735', 'm@t.com');
    const osId = await osWaitingApproval(owner);

    const res = await request(app).patch(`/service-orders/${osId}/budget`)
      .set('Authorization', `Bearer ${signCustomerToken(intruder, 'Mary')}`)
      .send({ status: 'APPROVED', code: CODE });

    expect(res.status).toBe(403);

    const after = await request(app).get(`/service-orders/${osId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.status).toBe('WAITING_APPROVAL');
  });

  // Divergencia de segredo entre a aplicacao e a function e o risco R4. O
  // sintoma e um 401 sem mensagem util, e este teste o nomeia.
  it('should return 401 GIVEN a token signed with a different secret WHEN reading the order', async () => {
    const customerId = await createCustomer();
    const osId = await osWaitingApproval(customerId);
    const foreign = jwt.sign({ type: 'customer', sub: customerId, cpf: CPF, name: 'John' }, 'outro-segredo');

    const res = await request(app).get(`/service-orders/${osId}/status`)
      .set('Authorization', `Bearer ${foreign}`);

    expect(res.status).toBe(401);
  });

  it('should return 400 GIVEN the wrong confirmation code WHEN the owner approves', async () => {
    const customerId = await createCustomer();
    const osId = await osWaitingApproval(customerId);

    const res = await request(app).patch(`/service-orders/${osId}/budget`)
      .set('Authorization', `Bearer ${signCustomerToken(customerId, 'John')}`)
      .send({ status: 'APPROVED', code: '0000' });

    expect(res.status).toBe(400);
  });

  it('should return 404 GIVEN an unregistered cpf WHEN the function looks the customer up', async () => {
    const res = await request(app).post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN).send({ cpf: '11144477735' });

    expect(res.status).toBe(404);
  });
});
