import { GetServiceOrderUseCase } from '../../../../src/use-cases/service-orders/GetServiceOrderUseCase';
import { ForbiddenError } from '../../../../src/entities/errors/AppError';
import { makeOSRepo, waitingApprovalOS } from '../../fixtures/serviceOrder';

// waitingApprovalOS.customerId === 'c-1'.
const OWNER = 'c-1';
const OTHER = 'c-2';

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
