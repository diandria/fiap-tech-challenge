import { Prisma } from '@prisma/client';
import { PostgresServiceOrderRepository } from '../../../../src/adapters/gateways/PostgresServiceOrderRepository';

function makePrisma() {
  const client: any = {
    serviceOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    serviceOrderService: { deleteMany: jest.fn(), createMany: jest.fn() },
    serviceOrderItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  client.$transaction = jest.fn(async (fn: any) => fn(client));
  return client;
}

const row = {
  id: '88888888-8888-4888-8888-888888888888',
  customerId: '11111111-1111-4111-8111-111111111111',
  vehicleId: '33333333-3333-4333-8333-333333333333',
  status: 'DIAGNOSIS',
  budgetTotal: new Prisma.Decimal('500.00'),
  createdAt: new Date('2026-01-01'),
  startedAt: null,
  finishedAt: null,
  deliveredAt: null,
  services: [{ serviceId: '44444444-4444-4444-8444-444444444444', startedAt: null, finishedAt: null }],
  items: [{ itemId: '66666666-6666-4666-8666-666666666666', quantity: 2 }],
};

describe('PostgresServiceOrderRepository', () => {
  it('should remount the aggregate GIVEN a row with relations WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue(row);

    const os = await new PostgresServiceOrderRepository(prisma).findById('88888888-8888-4888-8888-888888888888');

    expect(os?.id).toBe('88888888-8888-4888-8888-888888888888');
    expect(os?.services).toEqual([{ serviceId: '44444444-4444-4444-8444-444444444444' }]);
    expect(os?.items).toEqual([{ itemId: '66666666-6666-4666-8666-666666666666', quantity: 2 }]);
  });

  it('should convert Decimal budget to number GIVEN a row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue(row);

    const os = await new PostgresServiceOrderRepository(prisma).findById('88888888-8888-4888-8888-888888888888');

    expect(os?.budgetTotal).toBe(500);
    expect(typeof os?.budgetTotal).toBe('number');
  });

  it('should keep budgetTotal undefined GIVEN an order without a budget WHEN mapping', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue({ ...row, budgetTotal: null });

    const os = await new PostgresServiceOrderRepository(prisma).findById('88888888-8888-4888-8888-888888888888');

    expect(os?.budgetTotal).toBeUndefined();
  });

  it('should carry started and finished timestamps GIVEN a service line WHEN mapping', async () => {
    const prisma = makePrisma();
    const started = new Date('2026-02-01');
    const finished = new Date('2026-02-02');
    prisma.serviceOrder.findUnique.mockResolvedValue({
      ...row,
      services: [{ serviceId: '44444444-4444-4444-8444-444444444444', startedAt: started, finishedAt: finished }],
    });

    const os = await new PostgresServiceOrderRepository(prisma).findById('88888888-8888-4888-8888-888888888888');

    expect(os?.services[0]).toEqual({ serviceId: '44444444-4444-4444-8444-444444444444', startedAt: started, finishedAt: finished });
  });

  it('should translate excludeStatuses to notIn GIVEN the filter WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findMany.mockResolvedValue([]);

    await new PostgresServiceOrderRepository(prisma).findAll({
      excludeStatuses: ['FINISHED', 'DELIVERED'],
    });

    expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { notIn: ['FINISHED', 'DELIVERED'] } }),
      }),
    );
  });

  it('should apply an explicit status filter GIVEN status WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findMany.mockResolvedValue([]);

    await new PostgresServiceOrderRepository(prisma).findAll({ status: 'RECEIVED' });

    expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'RECEIVED' }) }),
    );
  });

  it('should translate date range to gte and lte GIVEN from and to WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findMany.mockResolvedValue([]);
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');

    await new PostgresServiceOrderRepository(prisma).findAll({ from, to });

    expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: from, lte: to } }) }),
    );
  });

  it('should wrap creation in a transaction GIVEN services and items WHEN create is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.create.mockResolvedValue({ ...row, services: [], items: [] });

    await new PostgresServiceOrderRepository(prisma).create({
      customerId: '11111111-1111-4111-8111-111111111111',
      vehicleId: '33333333-3333-4333-8333-333333333333',
      status: 'RECEIVED',
      services: [{ serviceId: '44444444-4444-4444-8444-444444444444' }],
      items: [{ itemId: '66666666-6666-4666-8666-666666666666', quantity: 2 }],
    } as any);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          services: { create: [{ serviceId: '44444444-4444-4444-8444-444444444444' }] },
          items: { create: [{ itemId: '66666666-6666-4666-8666-666666666666', quantity: 2 }] },
        }),
      }),
    );
  });

  it('should replace service lines inside a transaction GIVEN services WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue(row);
    prisma.serviceOrder.update.mockResolvedValue(row);

    await new PostgresServiceOrderRepository(prisma).update('88888888-8888-4888-8888-888888888888', {
      services: [{ serviceId: '55555555-5555-4555-8555-555555555555' }],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.serviceOrderService.deleteMany).toHaveBeenCalledWith({
      where: { serviceOrderId: '88888888-8888-4888-8888-888888888888' },
    });
    expect(prisma.serviceOrderService.createMany).toHaveBeenCalled();
  });

  it('should not touch relation tables GIVEN only a status change WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue(row);
    prisma.serviceOrder.update.mockResolvedValue(row);

    await new PostgresServiceOrderRepository(prisma).update('88888888-8888-4888-8888-888888888888', { status: 'APPROVED' });

    expect(prisma.serviceOrderService.deleteMany).not.toHaveBeenCalled();
    expect(prisma.serviceOrderItem.deleteMany).not.toHaveBeenCalled();
  });

  it('should return null GIVEN a missing order WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.serviceOrder.findUnique.mockResolvedValue(null);

    expect(await new PostgresServiceOrderRepository(prisma).update('99999999-9999-4999-8999-999999999999', { status: 'APPROVED' })).toBeNull();
  });

  it('should aggregate execution time per service GIVEN finished lines WHEN getAvgExecutionByService is called', async () => {
    const prisma = makePrisma();
    prisma.$queryRaw.mockResolvedValue([
      { serviceId: '44444444-4444-4444-8444-444444444444', avgMinutes: 42.5, count: BigInt(3) },
    ]);

    const result = await new PostgresServiceOrderRepository(prisma).getAvgExecutionByService();

    expect(result).toEqual([{ serviceId: '44444444-4444-4444-8444-444444444444', avgMinutes: 42.5, count: 3 }]);
  });
});
