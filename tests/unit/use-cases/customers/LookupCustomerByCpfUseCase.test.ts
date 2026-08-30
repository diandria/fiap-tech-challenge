import { LookupCustomerByCpfUseCase } from '../../../../src/use-cases/customers/LookupCustomerByCpfUseCase';
import { ValidationError, NotFoundError } from '../../../../src/entities/errors/AppError';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

describe('LookupCustomerByCpfUseCase', () => {
  it('should return id, name and active GIVEN an existing customer WHEN looking up', async () => {
    const useCase = new LookupCustomerByCpfUseCase(makeCustomerRepo(cpfCustomer));

    const result = await useCase.execute(cpfCustomer.taxId);

    expect(result).toEqual({ id: cpfCustomer.id, name: cpfCustomer.name, active: true });
  });

  it('should normalize a formatted cpf GIVEN punctuation WHEN looking up', async () => {
    const repo = makeCustomerRepo(cpfCustomer);
    const useCase = new LookupCustomerByCpfUseCase(repo);

    await useCase.execute('529.982.247-25');

    expect(repo.findByTaxIdIncludingInactive).toHaveBeenCalledWith('52998224725');
  });

  it('should report active false GIVEN a soft-deleted customer WHEN looking up', async () => {
    const deleted = { ...cpfCustomer, deletedAt: new Date('2026-02-01') };
    const useCase = new LookupCustomerByCpfUseCase(makeCustomerRepo(deleted));

    const result = await useCase.execute(cpfCustomer.taxId);

    expect(result.active).toBe(false);
  });

  it('should throw ValidationError GIVEN an invalid cpf WHEN looking up', async () => {
    const useCase = new LookupCustomerByCpfUseCase(makeCustomerRepo(cpfCustomer));

    await expect(useCase.execute('11111111111')).rejects.toBeInstanceOf(ValidationError);
  });

  // Sem esta guarda, um corpo sem cpf chegaria ao repositorio como "undefined"
  // e a falha apareceria como 404, apontando para o lugar errado.
  it('should throw ValidationError GIVEN a missing cpf WHEN looking up', async () => {
    const useCase = new LookupCustomerByCpfUseCase(makeCustomerRepo(cpfCustomer));

    await expect(useCase.execute(undefined as unknown as string)).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw NotFoundError GIVEN no customer for the cpf WHEN looking up', async () => {
    const useCase = new LookupCustomerByCpfUseCase(makeCustomerRepo(null));

    await expect(useCase.execute(cpfCustomer.taxId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
