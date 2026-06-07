import { findOSOrThrow, verifyCustomerCode } from '../../../../src/use-cases/utils/serviceOrderUtils';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { cpfCustomer, cnpjCustomer } from '../../fixtures/customer';
import { NotFoundError, ValidationError } from '../../../../src/entities/errors/AppError';

describe('findOSOrThrow', () => {
  it('GIVEN existing OS WHEN called THEN returns the service order', async () => {
    const repo = makeOSRepo(baseOS);
    const result = await findOSOrThrow(repo, 'os-1');
    expect(result).toMatchObject({ id: 'os-1' });
  });

  it('GIVEN missing OS WHEN called THEN throws NotFoundError', async () => {
    const repo = makeOSRepo(null);
    await expect(findOSOrThrow(repo, 'missing')).rejects.toThrow(NotFoundError);
  });
});

describe('verifyCustomerCode', () => {
  it('GIVEN CPF customer and correct 4-digit code WHEN verified THEN does not throw', () => {
    expect(() => verifyCustomerCode(cpfCustomer, '5299')).not.toThrow();
  });

  it('GIVEN CNPJ customer and correct 4-digit code WHEN verified THEN does not throw', () => {
    expect(() => verifyCustomerCode(cnpjCustomer, '1122')).not.toThrow();
  });

  it('GIVEN wrong code WHEN verified THEN throws ValidationError', () => {
    expect(() => verifyCustomerCode(cpfCustomer, '0000')).toThrow(ValidationError);
  });
});
