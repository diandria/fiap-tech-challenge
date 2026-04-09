import { RejectBudgetUseCase } from '../../../../src/application/use-cases/service-orders/RejectBudgetUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';
import { Customer } from '../../../../src/domain/entities/Customer';

// CNPJ digits: 11222333000181 → first 4: "1122"
const customer: Customer = {
  id: 'c-1', name: 'Maria', taxId: '11222333000181', taxType: 'CNPJ',
  email: 'm@t.com', phone: '11888888888', createdAt: new Date(), updatedAt: new Date(),
};

const pendingOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'WAITING_APPROVAL', budgetTotal: 150,
  services: [], items: [{ itemId: 'i-1', quantity: 1 }, { itemId: 'i-2', quantity: 3 }],
  createdAt: new Date(),
};

const makeOSRepo = (os = pendingOS): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...os, ...data })),
});

const makeCustomerRepo = (): ICustomerRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(customer),
  findByTaxId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeItemRepo = (): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce({ id: 'i-1', name: 'Plug', price: 10, stockQuantity: 5, reservedQuantity: 1 })
    .mockResolvedValueOnce({ id: 'i-2', name: 'Oil', price: 8, stockQuantity: 3, reservedQuantity: 3 }),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn(),
});

describe('RejectBudgetUseCase', () => {
  it('rejects budget with correct code, releases all item reservations, transitions to REJECTED', async () => {
    const osRepo = makeOSRepo();
    const itemRepo = makeItemRepo();
    const useCase = new RejectBudgetUseCase(osRepo, makeCustomerRepo(), itemRepo);
    const result = await useCase.execute('os-1', '1122');
    expect(result.status).toBe('REJECTED');
    // release: reservedQuantity decremented by quantity for each item
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 0 });
    expect(itemRepo.update).toHaveBeenCalledWith('i-2', { reservedQuantity: 0 });
    expect(itemRepo.update).toHaveBeenCalledTimes(2);
  });

  it('throws ValidationError for wrong code', async () => {
    const useCase = new RejectBudgetUseCase(makeOSRepo(), makeCustomerRepo(), makeItemRepo());
    await expect(useCase.execute('os-1', '9999'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('code') });
  });
});
