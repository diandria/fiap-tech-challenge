import { GetServiceOrderHistoryUseCase } from '../../../../src/use-cases/service-orders/GetServiceOrderHistoryUseCase';
import { ServiceOrderStatusChange } from '../../../../src/entities/ServiceOrderStatusChange';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';

const changes: ServiceOrderStatusChange[] = [
  { from: null, to: 'RECEIVED', changedAt: new Date('2026-01-01T10:00:00') },
  { from: 'RECEIVED', to: 'DIAGNOSIS', changedAt: new Date('2026-01-01T11:00:00') },
];

describe('GetServiceOrderHistoryUseCase', () => {
  it('GIVEN an existing order WHEN execute called THEN returns its status changes', async () => {
    const repo = makeOSRepo(baseOS);
    (repo.findStatusHistory as jest.Mock).mockResolvedValue(changes);

    const result = await new GetServiceOrderHistoryUseCase(repo).execute({ osId: 'os-1' });

    expect(result).toEqual({ serviceOrderId: 'os-1', history: changes });
    expect(repo.findStatusHistory).toHaveBeenCalledWith('os-1');
  });

  it('GIVEN a non-existing id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetServiceOrderHistoryUseCase(makeOSRepo(null));

    await expect(useCase.execute({ osId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN a customer who does not own the order WHEN execute called THEN throws ForbiddenError', async () => {
    const repo = makeOSRepo(baseOS);

    await expect(
      new GetServiceOrderHistoryUseCase(repo).execute({ osId: 'os-1', requesterCustomerId: 'someone-else' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findStatusHistory).not.toHaveBeenCalled();
  });
});
