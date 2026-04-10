import { GetCustomerByTaxIdUseCase } from '../../../../src/application/use-cases/customers/GetCustomerByTaxIdUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Customer } from '../../../../src/domain/entities/Customer';

const customer: Customer = {
  id: 'c-1', name: 'João', taxId: '52998224725', taxType: 'CPF',
  email: 'j@t.com', phone: '11999999999', createdAt: new Date(), updatedAt: new Date(),
};

const makeRepo = (result: Customer | null): ICustomerRepository => ({
  findAll: jest.fn(), findById: jest.fn(),
  findByTaxId: jest.fn().mockResolvedValue(result),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

describe('GetCustomerByTaxIdUseCase', () => {
  it('returns the customer when found', async () => {
    const useCase = new GetCustomerByTaxIdUseCase(makeRepo(customer));
    const result = await useCase.execute('52998224725');
    expect(result.taxId).toBe('52998224725');
  });

  it('throws NotFoundError when customer does not exist', async () => {
    const useCase = new GetCustomerByTaxIdUseCase(makeRepo(null));
    await expect(useCase.execute('00000000000')).rejects.toMatchObject({ statusCode: 404 });
  });
});
