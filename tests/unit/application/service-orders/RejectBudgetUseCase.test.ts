import { RejectBudgetUseCase } from '../../../../src/application/use-cases/service-orders/RejectBudgetUseCase';
import { IItemRepository } from '../../../../src/use-cases/ports/IItemRepository';
import { makeOSRepo, waitingApprovalOS } from '../../fixtures/serviceOrder';
import { makeCustomerRepo, cnpjCustomer } from '../../fixtures/customer';

// OS with two items to test full reservation release
const twoItemOS = {
  ...waitingApprovalOS,
  customerId: cnpjCustomer.id,
  items: [{ itemId: 'i-1', quantity: 1 }, { itemId: 'i-2', quantity: 3 }],
};

// Sequential findById needed to test two-item release
const makeSequentialItemRepo = (): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce({ id: 'i-1', name: 'Plug', price: 10, stockQuantity: 5, reservedQuantity: 1 })
    .mockResolvedValueOnce({ id: 'i-2', name: 'Oil', price: 8, stockQuantity: 3, reservedQuantity: 3 }),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn(),
});

describe('RejectBudgetUseCase', () => {
  it('GIVEN OS WAITING_APPROVAL and correct code WHEN execute called THEN transitions to REJECTED and releases item reservations', async () => {
    const osRepo = makeOSRepo(twoItemOS);
    const itemRepo = makeSequentialItemRepo();
    const useCase = new RejectBudgetUseCase(osRepo, makeCustomerRepo(cnpjCustomer), itemRepo);
    const result = await useCase.execute('os-1', '1122');
    expect(result.status).toBe('REJECTED');
    // release: reservedQuantity decremented by quantity for each item
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 0 });
    expect(itemRepo.update).toHaveBeenCalledWith('i-2', { reservedQuantity: 0 });
    expect(itemRepo.update).toHaveBeenCalledTimes(2);
  });

  it('GIVEN wrong code WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new RejectBudgetUseCase(makeOSRepo(twoItemOS), makeCustomerRepo(cnpjCustomer), makeSequentialItemRepo());
    await expect(useCase.execute('os-1', '9999'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('code') });
  });

  it('GIVEN OS not in WAITING_APPROVAL WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...twoItemOS, status: 'EXECUTION' as const };
    const useCase = new RejectBudgetUseCase(makeOSRepo(wrongOS), makeCustomerRepo(cnpjCustomer), makeSequentialItemRepo());
    await expect(useCase.execute('os-1', '1122')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RejectBudgetUseCase(makeOSRepo(null), makeCustomerRepo(cnpjCustomer), makeSequentialItemRepo());
    await expect(useCase.execute('missing', '1122')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN non-existing customer WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RejectBudgetUseCase(makeOSRepo(twoItemOS), makeCustomerRepo(null), makeSequentialItemRepo());
    await expect(useCase.execute('os-1', '1122')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN non-existing item in order WHEN execute called THEN throws NotFoundError', async () => {
    const nullItemRepo: IItemRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    };
    const useCase = new RejectBudgetUseCase(makeOSRepo(twoItemOS), makeCustomerRepo(cnpjCustomer), nullItemRepo);
    await expect(useCase.execute('os-1', '1122')).rejects.toMatchObject({ statusCode: 404 });
  });
});
