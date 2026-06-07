import { DeleteCustomerUseCase } from '../../../../src/use-cases/customers/DeleteCustomerUseCase';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

describe('DeleteCustomerUseCase', () => {
  it('GIVEN existing customer WHEN delete called THEN soft-deletes and resolves without value', async () => {
    const repo = makeCustomerRepo(cpfCustomer);
    const useCase = new DeleteCustomerUseCase(repo);
    await expect(useCase.execute('c-1')).resolves.toBeUndefined();
    expect(repo.softDelete).toHaveBeenCalledWith('c-1');
  });

  it('GIVEN non-existing customer WHEN delete called THEN throws NotFoundError', async () => {
    const repo = makeCustomerRepo(null);
    (repo.softDelete as jest.Mock).mockResolvedValue(false);
    const useCase = new DeleteCustomerUseCase(repo);
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
