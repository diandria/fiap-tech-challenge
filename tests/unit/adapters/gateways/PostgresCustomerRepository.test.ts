import { PostgresCustomerRepository } from '../../../../src/adapters/gateways/PostgresCustomerRepository';

function makePrisma() {
  return {
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana',
  taxId: '12345678909',
  taxType: 'CPF',
  email: 'ana@example.com',
  phone: '11999999999',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  deletedAt: null,
};

describe('PostgresCustomerRepository', () => {
  it('should map a row to a Customer entity GIVEN an existing row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(row);

    const customer = await new PostgresCustomerRepository(prisma).findById('11111111-1111-4111-8111-111111111111');

    expect(customer).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Ana',
      taxId: '12345678909',
      taxType: 'CPF',
      email: 'ana@example.com',
      phone: '11999999999',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });
  });

  it('should omit deletedAt GIVEN an active customer WHEN mapping', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(row);

    const customer = await new PostgresCustomerRepository(prisma).findById('11111111-1111-4111-8111-111111111111');

    expect(customer).not.toHaveProperty('deletedAt');
  });

  it('should exclude soft-deleted rows GIVEN any lookup WHEN querying by id', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);

    await new PostgresCustomerRepository(prisma).findById('11111111-1111-4111-8111-111111111111');

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111', deletedAt: null },
    });
  });

  it('should return null GIVEN no matching row WHEN findByTaxId is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);

    const customer = await new PostgresCustomerRepository(prisma).findByTaxId('00000000000');

    expect(customer).toBeNull();
  });

  it('should exclude soft-deleted rows GIVEN a list WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findMany.mockResolvedValue([row]);

    const customers = await new PostgresCustomerRepository(prisma).findAll();

    expect(prisma.customer.findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(customers).toHaveLength(1);
  });

  it('should return null GIVEN a missing customer WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);

    const result = await new PostgresCustomerRepository(prisma).update('99999999-9999-4999-8999-999999999999', { name: 'x' });

    expect(result).toBeNull();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('should stamp deletedAt GIVEN an existing customer WHEN softDelete is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(row);
    prisma.customer.update.mockResolvedValue({ ...row, deletedAt: new Date() });

    const ok = await new PostgresCustomerRepository(prisma).softDelete('11111111-1111-4111-8111-111111111111');

    expect(ok).toBe(true);
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should return false GIVEN a missing customer WHEN softDelete is called', async () => {
    const prisma = makePrisma();
    prisma.customer.findFirst.mockResolvedValue(null);

    expect(await new PostgresCustomerRepository(prisma).softDelete('99999999-9999-4999-8999-999999999999')).toBe(false);
  });
});

describe('PostgresCustomerRepository — malformed identifiers', () => {
  it('should return null without querying GIVEN a non-uuid id WHEN findById is called', async () => {
    const prisma = makePrisma();

    const customer = await new PostgresCustomerRepository(prisma).findById('not-a-uuid');

    expect(customer).toBeNull();
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('should return false without querying GIVEN a non-uuid id WHEN softDelete is called', async () => {
    const prisma = makePrisma();

    expect(await new PostgresCustomerRepository(prisma).softDelete('000000000000000000000000')).toBe(false);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });
});
