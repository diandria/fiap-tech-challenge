import { ApproveBudgetUseCase } from '../../../../src/application/use-cases/service-orders/ApproveBudgetUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';
import { Customer } from '../../../../src/domain/entities/Customer';

// CPF digits: 52998224725 → first 4: "5299"
const customer: Customer = {
  id: 'c-1', name: 'João', taxId: '52998224725', taxType: 'CPF',
  email: 'j@t.com', phone: '11999999999', createdAt: new Date(), updatedAt: new Date(),
};

const pendingOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'WAITING_APPROVAL', budgetTotal: 200,
  services: [], items: [{ itemId: 'i-1', quantity: 2 }],
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
  findById: jest.fn().mockResolvedValue({ id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 2 }),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn(),
});

describe('ApproveBudgetUseCase', () => {
  it('approves budget with correct 4-digit code and transitions to EXECUTION', async () => {
    const osRepo = makeOSRepo();
    const itemRepo = makeItemRepo();
    const useCase = new ApproveBudgetUseCase(osRepo, makeCustomerRepo(), itemRepo);
    const result = await useCase.execute('os-1', '5299');
    expect(result.status).toBe('EXECUTION');
    // consume: stockQuantity (10-2=8), reservedQuantity (2-2=0)
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { stockQuantity: 8, reservedQuantity: 0 });
  });

  it('throws ValidationError for wrong code', async () => {
    const useCase = new ApproveBudgetUseCase(makeOSRepo(), makeCustomerRepo(), makeItemRepo());
    await expect(useCase.execute('os-1', '0000'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('code') });
  });

  it('throws ValidationError when OS is not WAITING_APPROVAL', async () => {
    const wrongOS = { ...pendingOS, status: 'EXECUTION' as const };
    const useCase = new ApproveBudgetUseCase(makeOSRepo(wrongOS), makeCustomerRepo(), makeItemRepo());
    await expect(useCase.execute('os-1', '5299')).rejects.toMatchObject({ statusCode: 400 });
  });
});
