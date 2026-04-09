import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customers/CreateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Customer } from '../../../../src/domain/entities/Customer';

const validInput = {
  name: 'João Silva',
  taxId: '529.982.247-25',
  taxType: 'CPF' as const,
  email: 'joao@test.com',
  phone: '11999999999',
};

const makeRepo = (override?: Partial<ICustomerRepository>): ICustomerRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByTaxId: jest.fn().mockResolvedValue(null),
  findByTaxType: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'c-1', ...data })),
  update: jest.fn(),
  delete: jest.fn(),
  ...override,
});

describe('CreateCustomerUseCase', () => {
  it('creates a customer with a valid CPF', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('c-1');
    expect(result.taxId).toBe('529.982.247-25');
    expect(result.taxType).toBe('CPF');
  });

  it('creates a customer with a valid CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    const result = await useCase.execute({ ...validInput, taxId: '11.222.333/0001-81', taxType: 'CNPJ' });
    expect(result.id).toBe('c-1');
    expect(result.taxType).toBe('CNPJ');
  });

  it('throws ValidationError for an invalid taxType', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, taxType: 'RG' as any }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for an invalid CPF/CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, taxId: '111.111.111-11' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError if CPF/CNPJ is already registered', async () => {
    const existing: Customer = { id: 'c-2', ...validInput };
    const useCase = new CreateCustomerUseCase(
      makeRepo({ findByTaxId: jest.fn().mockResolvedValue(existing) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
