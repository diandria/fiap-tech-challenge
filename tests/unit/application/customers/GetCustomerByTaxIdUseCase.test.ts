import { GetCustomerByTaxIdUseCase } from '../../../../src/use-cases/customers/GetCustomerByTaxIdUseCase';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

describe('GetCustomerByTaxIdUseCase', () => {
  it('GIVEN existing taxId WHEN execute called THEN returns matching customer', async () => {
    const useCase = new GetCustomerByTaxIdUseCase(makeCustomerRepo(cpfCustomer));
    const result = await useCase.execute('52998224725');
    expect(result.taxId).toBe('52998224725');
  });

  it('GIVEN unknown taxId WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetCustomerByTaxIdUseCase(makeCustomerRepo(null));
    await expect(useCase.execute('00000000000')).rejects.toMatchObject({ statusCode: 404 });
  });
});
