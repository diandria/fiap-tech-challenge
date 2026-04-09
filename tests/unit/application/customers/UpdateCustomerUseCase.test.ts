import { UpdateCustomerUseCase } from '../../../../src/application/use-cases/customers/UpdateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Customer } from '../../../../src/domain/entities/Customer';

const existing: Customer = {
  id: 'c-1',
  name: 'João Silva',
  taxId: '52998224725',
  taxType: 'CPF',
  email: 'joao@test.com',
  phone: '11999999999',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeRepo = (override?: Partial<ICustomerRepository>): ICustomerRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByTaxId: jest.fn(),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({ ...existing, name: 'Updated' }),
  softDelete: jest.fn(),
  ...override,
});

describe('UpdateCustomerUseCase', () => {
  it('updates allowed fields successfully', async () => {
    const useCase = new UpdateCustomerUseCase(makeRepo());
    const result = await useCase.execute('c-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('throws ValidationError when taxId is provided', async () => {
    const useCase = new UpdateCustomerUseCase(makeRepo());
    await expect(useCase.execute('c-1', { taxId: '52998224725' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError when taxType is provided', async () => {
    const useCase = new UpdateCustomerUseCase(makeRepo());
    await expect(useCase.execute('c-1', { taxType: 'CNPJ' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for an invalid phone number', async () => {
    const useCase = new UpdateCustomerUseCase(makeRepo());
    await expect(useCase.execute('c-1', { phone: '123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when customer does not exist', async () => {
    const useCase = new UpdateCustomerUseCase(makeRepo({ update: jest.fn().mockResolvedValue(null) }));
    await expect(useCase.execute('nonexistent', { name: 'X' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
