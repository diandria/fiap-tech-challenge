import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customers/CreateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Customer } from '../../../../src/domain/entities/Customer';

const validInput = {
  name: 'João Silva',
  cpfCnpj: '529.982.247-25',
  email: 'joao@test.com',
  phone: '11999999999',
};

const makeRepo = (override?: Partial<ICustomerRepository>): ICustomerRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByCpfCnpj: jest.fn().mockResolvedValue(null),
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
    expect(result.cpfCnpj).toBe('529.982.247-25');
  });

  it('creates a customer with a valid CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    const result = await useCase.execute({ ...validInput, cpfCnpj: '11.222.333/0001-81' });
    expect(result.id).toBe('c-1');
  });

  it('throws ValidationError for an invalid CPF/CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, cpfCnpj: '111.111.111-11' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError if CPF/CNPJ is already registered', async () => {
    const existing: Customer = { id: 'c-2', ...validInput };
    const useCase = new CreateCustomerUseCase(
      makeRepo({ findByCpfCnpj: jest.fn().mockResolvedValue(existing) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
