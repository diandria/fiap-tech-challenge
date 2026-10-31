import { ListServiceOrdersUseCase } from '../../../../src/use-cases/service-orders/ListServiceOrdersUseCase';
import { makeOSRepo, receivedOS, executionOS, waitingApprovalOS } from '../../fixtures/serviceOrder';

describe('ListServiceOrdersUseCase', () => {
  it('GIVEN no filters WHEN execute called THEN excludes FINISHED and DELIVERED by default', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new ListServiceOrdersUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatuses: ['FINISHED', 'DELIVERED'] }),
    );
    expect(result).toHaveLength(1);
  });

  it('GIVEN status filter WHEN execute called THEN delegates filter to repository', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new ListServiceOrdersUseCase(repo);
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    await useCase.execute({ status: 'RECEIVED', customerId: 'c-1', from, to });
    expect(repo.findAll).toHaveBeenCalledWith({ status: 'RECEIVED', customerId: 'c-1', from, to });
  });

  it('GIVEN orders in several statuses WHEN execute called THEN PAID comes right after EXECUTION', async () => {
    const repo = makeOSRepo(receivedOS);
    const paid = { ...receivedOS, id: 'os-paid', status: 'PAID' as const };
    (repo.findAll as jest.Mock).mockResolvedValue([receivedOS, waitingApprovalOS, paid, executionOS]);

    const result = await new ListServiceOrdersUseCase(repo).execute();

    expect(result.map((order) => order.status)).toEqual(['EXECUTION', 'PAID', 'WAITING_APPROVAL', 'RECEIVED']);
  });
});
