import { Prisma } from '@prisma/client';
import { PostgresItemRepository } from '../../../../src/adapters/gateways/PostgresItemRepository';

function makePrisma() {
  return {
    item: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

const row = {
  id: 'i1',
  name: 'Filtro de oleo',
  price: new Prisma.Decimal('50.00'),
  stockQuantity: 10,
  reservedQuantity: 3,
};

describe('PostgresItemRepository', () => {
  it('should convert Decimal price to number GIVEN a row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(row);

    const item = await new PostgresItemRepository(prisma).findById('i1');

    expect(item).toEqual({
      id: 'i1',
      name: 'Filtro de oleo',
      price: 50,
      stockQuantity: 10,
      reservedQuantity: 3,
    });
  });

  it('should return null GIVEN no row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).findById('nope')).toBeNull();
  });

  it('should persist the absolute reserved quantity GIVEN an update WHEN called by a use case', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(row);
    prisma.item.update.mockResolvedValue({ ...row, reservedQuantity: 5 });

    await new PostgresItemRepository(prisma).update('i1', { reservedQuantity: 5 });

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { reservedQuantity: 5 },
    });
  });

  it('should return null GIVEN a missing item WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).update('nope', { reservedQuantity: 1 })).toBeNull();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('should return false GIVEN a missing item WHEN delete is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).delete('nope')).toBe(false);
    expect(prisma.item.delete).not.toHaveBeenCalled();
  });
});
