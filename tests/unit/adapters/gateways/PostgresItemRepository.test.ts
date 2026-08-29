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
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Filtro de oleo',
  price: new Prisma.Decimal('50.00'),
  stockQuantity: 10,
  reservedQuantity: 3,
};

describe('PostgresItemRepository', () => {
  it('should convert Decimal price to number GIVEN a row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(row);

    const item = await new PostgresItemRepository(prisma).findById('66666666-6666-4666-8666-666666666666');

    expect(item).toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Filtro de oleo',
      price: 50,
      stockQuantity: 10,
      reservedQuantity: 3,
    });
  });

  it('should return null GIVEN no row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).findById('99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('should persist the absolute reserved quantity GIVEN an update WHEN called by a use case', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(row);
    prisma.item.update.mockResolvedValue({ ...row, reservedQuantity: 5 });

    await new PostgresItemRepository(prisma).update('66666666-6666-4666-8666-666666666666', { reservedQuantity: 5 });

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: '66666666-6666-4666-8666-666666666666' },
      data: { reservedQuantity: 5 },
    });
  });

  it('should return null GIVEN a missing item WHEN update is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).update('99999999-9999-4999-8999-999999999999', { reservedQuantity: 1 })).toBeNull();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it('should return false GIVEN a missing item WHEN delete is called', async () => {
    const prisma = makePrisma();
    prisma.item.findUnique.mockResolvedValue(null);

    expect(await new PostgresItemRepository(prisma).delete('99999999-9999-4999-8999-999999999999')).toBe(false);
    expect(prisma.item.delete).not.toHaveBeenCalled();
  });
});
