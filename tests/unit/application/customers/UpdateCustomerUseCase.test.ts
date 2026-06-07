import { UpdateCustomerUseCase } from '../../../../src/use-cases/customers/UpdateCustomerUseCase';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

describe('UpdateCustomerUseCase', () => {
  it('GIVEN existing customer and allowed fields WHEN update called THEN returns updated customer', async () => {
    const repo = makeCustomerRepo(cpfCustomer);
    const useCase = new UpdateCustomerUseCase(repo);
    const result = await useCase.execute('c-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('GIVEN update with taxId WHEN update called THEN throws ValidationError', async () => {
    const useCase = new UpdateCustomerUseCase(makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('c-1', { taxId: '52998224725' } as any))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN update with taxType WHEN update called THEN throws ValidationError', async () => {
    const useCase = new UpdateCustomerUseCase(makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('c-1', { taxType: 'CNPJ' } as any))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN invalid phone number WHEN update called THEN throws ValidationError', async () => {
    const useCase = new UpdateCustomerUseCase(makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('c-1', { phone: '123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing customer WHEN update called THEN throws NotFoundError', async () => {
    const useCase = new UpdateCustomerUseCase(makeCustomerRepo(null));
    await expect(useCase.execute('nonexistent', { name: 'X' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
