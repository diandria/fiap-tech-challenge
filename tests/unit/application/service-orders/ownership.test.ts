import { GetServiceOrderUseCase } from '../../../../src/use-cases/service-orders/GetServiceOrderUseCase';
import { ApproveBudgetUseCase } from '../../../../src/use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from '../../../../src/use-cases/service-orders/RejectBudgetUseCase';
import { ForbiddenError } from '../../../../src/entities/errors/AppError';
import { makeOSRepo, waitingApprovalOS } from '../../fixtures/serviceOrder';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

// waitingApprovalOS.customerId === 'c-1'; cpfCustomer.taxId comeca com '5299'.
const OWNER = 'c-1';
const OTHER = 'c-2';
const CODE = '5299';

const notifier = { execute: jest.fn().mockResolvedValue(undefined) };
const makeItemRepo = () => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue({ id: 'i-1', reservedQuantity: 5 }),
  create: jest.fn(), update: jest.fn().mockResolvedValue(undefined), softDelete: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

describe('service order ownership on read', () => {
  it('should return the order GIVEN the requester owns it WHEN getting', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(waitingApprovalOS));

    const result = await useCase.execute({ osId: 'os-1', requesterCustomerId: OWNER });

    expect(result.id).toBe('os-1');
  });

  it('should throw ForbiddenError GIVEN the requester is another customer WHEN getting', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(waitingApprovalOS));

    await expect(
      useCase.execute({ osId: 'os-1', requesterCustomerId: OTHER }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  // A missing requester means an employee call, which has already passed the
  // route's requireRole.
  it('should not restrict GIVEN no requester WHEN getting', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(waitingApprovalOS));

    await expect(useCase.execute({ osId: 'os-1' })).resolves.toBeDefined();
  });
});

describe('service order ownership on budget decision', () => {
  // The test that proves the protection really works. The request being
  // refused is not enough: the side effect must not happen. A test that only
  // looked at the HTTP status would pass even with the order already approved.
  it('should not change the status GIVEN a non-owner approves WHEN deciding the budget', async () => {
    const repo = makeOSRepo(waitingApprovalOS);
    const useCase = new ApproveBudgetUseCase(repo, makeCustomerRepo(cpfCustomer), notifier);

    await expect(
      useCase.execute({ osId: 'os-1', code: CODE, requesterCustomerId: OTHER }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(repo.update).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
  });

  it('should approve GIVEN the owner decides WHEN deciding the budget', async () => {
    const repo = makeOSRepo(waitingApprovalOS);
    const useCase = new ApproveBudgetUseCase(repo, makeCustomerRepo(cpfCustomer), notifier);

    await useCase.execute({ osId: 'os-1', code: CODE, requesterCustomerId: OWNER });

    expect(repo.update).toHaveBeenCalledWith('os-1', { status: 'APPROVED' });
  });

  // On rejection the side effect includes returning the reserved stock. A late
  // 403 would return parts belonging to an order that is still standing.
  it('should not release reserved stock GIVEN a non-owner rejects WHEN deciding the budget', async () => {
    const repo = makeOSRepo(waitingApprovalOS);
    const itemRepo = makeItemRepo();
    const useCase = new RejectBudgetUseCase(repo, makeCustomerRepo(cpfCustomer), itemRepo as never, notifier);

    await expect(
      useCase.execute({ osId: 'os-1', code: CODE, requesterCustomerId: OTHER }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(itemRepo.update).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('should reject the budget GIVEN the owner decides WHEN deciding the budget', async () => {
    const repo = makeOSRepo(waitingApprovalOS);
    const useCase = new RejectBudgetUseCase(
      repo, makeCustomerRepo(cpfCustomer), makeItemRepo() as never, notifier,
    );

    await useCase.execute({ osId: 'os-1', code: CODE, requesterCustomerId: OWNER });

    expect(repo.update).toHaveBeenCalledWith('os-1', { status: 'REJECTED' });
  });

  it('should not restrict GIVEN no requester WHEN deciding the budget', async () => {
    const repo = makeOSRepo(waitingApprovalOS);
    const useCase = new ApproveBudgetUseCase(repo, makeCustomerRepo(cpfCustomer), notifier);

    await expect(useCase.execute({ osId: 'os-1', code: CODE })).resolves.toBeDefined();
  });
});
