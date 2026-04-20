import { ListServiceOrdersUseCase } from '../../../../src/application/use-cases/service-orders/ListServiceOrdersUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';

describe('ListServiceOrdersUseCase', () => {
  it('GIVEN no filters WHEN execute called THEN returns all service orders', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new ListServiceOrdersUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalledWith(undefined);
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
});
