import { GetServiceOrderUseCase } from '../../../../src/application/use-cases/service-orders/GetServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';

describe('GetServiceOrderUseCase', () => {
  it('GIVEN existing OS id WHEN execute called THEN returns the service order', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(receivedOS));
    const result = await useCase.execute('os-1');
    expect(result.id).toBe('os-1');
  });

  it('GIVEN non-existing id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetServiceOrderUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
