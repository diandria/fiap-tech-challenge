import { CreateServiceOrderUseCase } from '../../../../src/use-cases/service-orders/CreateServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';

describe('CreateServiceOrderUseCase', () => {
  it('GIVEN valid customerId and vehicleId WHEN execute called THEN creates OS with RECEIVED status', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new CreateServiceOrderUseCase(repo);
    const result = await useCase.execute({ customerId: 'c-1', vehicleId: 'v-1' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'c-1', vehicleId: 'v-1', status: 'RECEIVED',
    }));
    expect(result.status).toBe('RECEIVED');
  });
});
