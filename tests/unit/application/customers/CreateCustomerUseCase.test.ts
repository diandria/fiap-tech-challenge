import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customers/CreateCustomerUseCase';
import { makeCustomerRepo, cpfCustomer, cnpjCustomer } from '../../fixtures/customer';

const validInput = {
  name: cpfCustomer.name,
  taxId: '529.982.247-25',
  taxType: 'CPF' as const,
  email: cpfCustomer.email,
  phone: cpfCustomer.phone,
};

describe('CreateCustomerUseCase', () => {
  it('GIVEN valid CPF customer data WHEN execute called THEN returns created customer with normalized taxId', async () => {
    const repo = makeCustomerRepo(null);
    (repo.create as jest.Mock).mockImplementation((data) => Promise.resolve({ id: 'c-1', ...data }));
    const useCase = new CreateCustomerUseCase(repo);
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('c-1');
    expect(result.taxId).toBe('52998224725');
    expect(result.taxType).toBe('CPF');
  });

  it('GIVEN valid CNPJ customer data WHEN execute called THEN returns created customer with CNPJ tax type', async () => {
    const repo = makeCustomerRepo(null);
    (repo.create as jest.Mock).mockImplementation((data) => Promise.resolve({ id: 'c-1', ...data }));
    const useCase = new CreateCustomerUseCase(repo);
    const result = await useCase.execute({ ...validInput, taxId: '11.222.333/0001-81', taxType: 'CNPJ' });
    expect(result.id).toBe('c-1');
    expect(result.taxType).toBe('CNPJ');
  });

  it('GIVEN invalid phone number WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateCustomerUseCase(makeCustomerRepo(null));
    await expect(useCase.execute({ ...validInput, phone: '123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN invalid taxType WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateCustomerUseCase(makeCustomerRepo(null));
    await expect(useCase.execute({ ...validInput, taxType: 'RG' as any }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN invalid CPF/CNPJ WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateCustomerUseCase(makeCustomerRepo(null));
    await expect(useCase.execute({ ...validInput, taxId: '111.111.111-11' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN taxId already registered WHEN execute called THEN throws ConflictError', async () => {
    const useCase = new CreateCustomerUseCase(makeCustomerRepo(cnpjCustomer));
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
