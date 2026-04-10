import { DeleteCustomerUseCase } from '../../../../src/application/use-cases/customers/DeleteCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';

const makeRepo = (deleted: boolean): ICustomerRepository => ({
  findAll: jest.fn(), findById: jest.fn(), findByTaxId: jest.fn(),
  create: jest.fn(), update: jest.fn(),
  softDelete: jest.fn().mockResolvedValue(deleted),
});

describe('DeleteCustomerUseCase', () => {
  it('soft-deletes the customer successfully', async () => {
    const repo = makeRepo(true);
    const useCase = new DeleteCustomerUseCase(repo);
    await expect(useCase.execute('c-1')).resolves.toBeUndefined();
    expect(repo.softDelete).toHaveBeenCalledWith('c-1');
  });

  it('throws NotFoundError when customer does not exist', async () => {
    const useCase = new DeleteCustomerUseCase(makeRepo(false));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
