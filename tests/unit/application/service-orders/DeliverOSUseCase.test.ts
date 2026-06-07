import { DeliverOSUseCase } from '../../../../src/use-cases/service-orders/DeliverOSUseCase';
import { makeOSRepo, finishedOS } from '../../fixtures/serviceOrder';

describe('DeliverOSUseCase', () => {
  it('GIVEN OS in FINISHED WHEN execute called THEN transitions to DELIVERED and records deliveredAt', async () => {
    const repo = makeOSRepo(finishedOS);
    const useCase = new DeliverOSUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('DELIVERED');
    expect(result.deliveredAt).toBeDefined();
  });

  it('GIVEN OS not in FINISHED WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...finishedOS, status: 'RECEIVED' as const };
    const useCase = new DeliverOSUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new DeliverOSUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
