import { DeleteServiceUseCase } from '../../../../src/application/use-cases/services/DeleteServiceUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';

const makeRepo = (deleted: boolean): IServiceRepository => ({
  findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(),
  delete: jest.fn().mockResolvedValue(deleted),
});

describe('DeleteServiceUseCase', () => {
  it('deletes the service successfully', async () => {
    const repo = makeRepo(true);
    const useCase = new DeleteServiceUseCase(repo);
    await expect(useCase.execute('s-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('s-1');
  });

  it('throws NotFoundError when service does not exist', async () => {
    const useCase = new DeleteServiceUseCase(makeRepo(false));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
