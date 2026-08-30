import { GetServiceOrderUseCase } from '../../../../src/use-cases/service-orders/GetServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';

describe('GetServiceOrderUseCase', () => {
  it('GIVEN existing OS id WHEN execute called THEN returns the service order', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(receivedOS));
    const result = await useCase.execute({ osId: 'os-1' });
    expect(result.id).toBe('os-1');
  });

  it('GIVEN non-existing id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(null));
    await expect(useCase.execute({ osId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
