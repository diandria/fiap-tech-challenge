import { StartExecutionUseCase } from '../../../../src/use-cases/service-orders/StartExecutionUseCase';
import { IStatusChangeNotifier } from '../../../../src/use-cases/ports/IStatusChangeNotifier';
import { IServiceOrderRepository } from '../../../../src/use-cases/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../../src/use-cases/ports/IItemRepository';
import { makeOSRepo, approvedOS } from '../../fixtures/serviceOrder';

const makeNotifyStatusChange = (): IStatusChangeNotifier => ({
  execute: jest.fn().mockResolvedValue(undefined),
});

const twoItemApprovedOS = {
  ...approvedOS,
  items: [{ itemId: 'i-1', quantity: 2 }, { itemId: 'i-2', quantity: 1 }],
};

// Sequential findById needed to handle two different items in order
const makeSequentialItemRepo = (): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce({ id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 4 })
    .mockResolvedValueOnce({ id: 'i-2', name: 'Oil', price: 15, stockQuantity: 5, reservedQuantity: 1 }),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn(),
});

describe('StartExecutionUseCase', () => {
  it('GIVEN OS in APPROVED status WHEN execute called THEN transitions to EXECUTION and decrements stock', async () => {
    const osRepo = makeOSRepo(twoItemApprovedOS);
    const itemRepo = makeSequentialItemRepo();
    const useCase = new StartExecutionUseCase(osRepo, itemRepo, makeNotifyStatusChange());
    const result = await useCase.execute('os-1');

    // i-1: stockQuantity (10-2=8), reservedQuantity (4-2=2)
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { stockQuantity: 8, reservedQuantity: 2 });
    // i-2: stockQuantity (5-1=4), reservedQuantity (1-1=0)
    expect(itemRepo.update).toHaveBeenCalledWith('i-2', { stockQuantity: 4, reservedQuantity: 0 });
    expect(osRepo.update).toHaveBeenCalledWith('os-1', expect.objectContaining({ startedAt: expect.any(Date) }));
    expect(result.status).toBe('EXECUTION');
  });

  it('GIVEN OS transitions to EXECUTION WHEN execute called THEN notifyStatusChange is invoked', async () => {
    const osRepo = makeOSRepo(twoItemApprovedOS);
    const notifyStatusChange = makeNotifyStatusChange();
    const useCase = new StartExecutionUseCase(osRepo, makeSequentialItemRepo(), notifyStatusChange);
    await useCase.execute('os-1');
    expect(notifyStatusChange.execute).toHaveBeenCalledWith({ osId: 'os-1' });
  });

  it('GIVEN OS not in APPROVED WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...twoItemApprovedOS, status: 'WAITING_APPROVAL' as const };
    const useCase = new StartExecutionUseCase(makeOSRepo(wrongOS), makeSequentialItemRepo(), makeNotifyStatusChange());
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const osRepo: IServiceOrderRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(),
      getAvgExecutionByService: jest.fn().mockResolvedValue([]),
    };
    const useCase = new StartExecutionUseCase(osRepo, makeSequentialItemRepo(), makeNotifyStatusChange());
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN non-existing item in catalog WHEN execute called THEN throws NotFoundError', async () => {
    const nullItemRepo: IItemRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    };
    const useCase = new StartExecutionUseCase(makeOSRepo(twoItemApprovedOS), nullItemRepo, makeNotifyStatusChange());
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
