import { Prisma } from '@prisma/client';
import { PostgresServiceRepository } from '../../../../src/adapters/gateways/PostgresServiceRepository';

function makePrisma() {
  return {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Troca de oleo',
  price: new Prisma.Decimal('149.90'),
  estimatedMinutes: 30,
};

describe('PostgresServiceRepository', () => {
  it('should convert Decimal price to number GIVEN a row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.service.findUnique.mockResolvedValue(row);

    const service = await new PostgresServiceRepository(prisma).findById('44444444-4444-4444-8444-444444444444');

    expect(service?.price).toBe(149.9);
    expect(typeof service?.price).toBe('number');
  });

  it('should not leak the Decimal type GIVEN a list WHEN findAll is called', async () => {
    const prisma = makePrisma();
    prisma.service.findMany.mockResolvedValue([row]);

    const services = await new PostgresServiceRepository(prisma).findAll();

    expect(services[0]).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Troca de oleo',
      price: 149.9,
      estimatedMinutes: 30,
    });
  });

  it('should return null GIVEN no row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.service.findUnique.mockResolvedValue(null);

    expect(await new PostgresServiceRepository(prisma).findById('99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('should return null GIVEN a missing service WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.service.findUnique.mockResolvedValue(null);

    expect(await new PostgresServiceRepository(prisma).update('99999999-9999-4999-8999-999999999999', { price: 1 })).toBeNull();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('should return false GIVEN a missing service WHEN delete is called', async () => {
    const prisma = makePrisma();
    prisma.service.findUnique.mockResolvedValue(null);

    expect(await new PostgresServiceRepository(prisma).delete('99999999-9999-4999-8999-999999999999')).toBe(false);
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });
});
