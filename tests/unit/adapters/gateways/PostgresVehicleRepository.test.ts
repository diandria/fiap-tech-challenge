import { PostgresVehicleRepository } from '../../../../src/adapters/gateways/PostgresVehicleRepository';

function makePrisma() {
  return {
    vehicle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

const row = { id: '33333333-3333-4333-8333-333333333333', customerId: '11111111-1111-4111-8111-111111111111', plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2020 };

describe('PostgresVehicleRepository', () => {
  it('should map a row to a Vehicle entity GIVEN an existing row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findUnique.mockResolvedValue(row);

    const vehicle = await new PostgresVehicleRepository(prisma).findById('33333333-3333-4333-8333-333333333333');

    expect(vehicle).toEqual(row);
  });

  it('should return null GIVEN no row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findUnique.mockResolvedValue(null);

    expect(await new PostgresVehicleRepository(prisma).findById('99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('should filter by customer GIVEN a customerId WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findMany.mockResolvedValue([row]);

    await new PostgresVehicleRepository(prisma).findAll('11111111-1111-4111-8111-111111111111');

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({ where: { customerId: '11111111-1111-4111-8111-111111111111' } });
  });

  it('should list every vehicle GIVEN no customerId WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findMany.mockResolvedValue([row]);

    await new PostgresVehicleRepository(prisma).findAll();

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({ where: {} });
  });

  it('should look up by plate GIVEN a plate WHEN findByPlate is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findUnique.mockResolvedValue(row);

    const vehicle = await new PostgresVehicleRepository(prisma).findByPlate('ABC1D23');

    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({ where: { plate: 'ABC1D23' } });
    expect(vehicle?.plate).toBe('ABC1D23');
  });

  it('should return null GIVEN a missing vehicle WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findUnique.mockResolvedValue(null);

    expect(await new PostgresVehicleRepository(prisma).update('99999999-9999-4999-8999-999999999999', { brand: 'x' })).toBeNull();
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it('should return false GIVEN a missing vehicle WHEN delete is called', async () => {
    const prisma = makePrisma();
    prisma.vehicle.findUnique.mockResolvedValue(null);

    expect(await new PostgresVehicleRepository(prisma).delete('99999999-9999-4999-8999-999999999999')).toBe(false);
    expect(prisma.vehicle.delete).not.toHaveBeenCalled();
  });
});
