import { validateCPF, validateCNPJ, validatePlate, validateTaxId } from '../../../src/domain/validators';

describe('validateCPF', () => {
  it('accepts a valid CPF with formatting', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
  });
  it('accepts a valid CPF digits only', () => {
    expect(validateCPF('52998224725')).toBe(true);
  });
  it('rejects wrong first check digit', () => {
    expect(validateCPF('529.982.247-35')).toBe(false);
  });
  it('rejects wrong second check digit', () => {
    expect(validateCPF('529.982.247-24')).toBe(false);
  });
  it('rejects all-same-digit CPF', () => {
    expect(validateCPF('111.111.111-11')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(validateCPF('1234')).toBe(false);
  });
});

describe('validateCNPJ', () => {
  it('accepts a valid CNPJ with formatting', () => {
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
  });
  it('accepts a valid CNPJ digits only', () => {
    expect(validateCNPJ('11222333000181')).toBe(true);
  });
  it('rejects wrong first check digit', () => {
    expect(validateCNPJ('11.222.333/0001-91')).toBe(false);
  });
  it('rejects all-same-digit CNPJ', () => {
    expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(validateCNPJ('1234')).toBe(false);
  });
});

describe('validatePlate', () => {
  it('accepts old format with dash', () => {
    expect(validatePlate('ABC-1234')).toBe(true);
  });
  it('accepts old format without dash', () => {
    expect(validatePlate('ABC1234')).toBe(true);
  });
  it('accepts old format lowercase', () => {
    expect(validatePlate('abc-1234')).toBe(true);
  });
  it('accepts Mercosul format', () => {
    expect(validatePlate('ABC1D23')).toBe(true);
  });
  it('rejects invalid format', () => {
    expect(validatePlate('ABCD123')).toBe(false);
  });
  it('rejects all digits', () => {
    expect(validatePlate('12341234')).toBe(false);
  });
});

describe('validateTaxId', () => {
  it('validates a valid CPF when type is CPF', () => {
    expect(validateTaxId('529.982.247-25', 'CPF')).toBe(true);
  });
  it('rejects an invalid CPF when type is CPF', () => {
    expect(validateTaxId('111.111.111-11', 'CPF')).toBe(false);
  });
  it('validates a valid CNPJ when type is CNPJ', () => {
    expect(validateTaxId('11.222.333/0001-81', 'CNPJ')).toBe(true);
  });
  it('rejects an invalid CNPJ when type is CNPJ', () => {
    expect(validateTaxId('11.111.111/1111-11', 'CNPJ')).toBe(false);
  });
});
