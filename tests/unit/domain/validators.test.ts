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
  it('delegates to CPF for 11 digits', () => {
    expect(validateTaxId('529.982.247-25')).toBe(true);
  });
  it('delegates to CNPJ for 14 digits', () => {
    expect(validateTaxId('11.222.333/0001-81')).toBe(true);
  });
  it('rejects other lengths', () => {
    expect(validateTaxId('12345')).toBe(false);
  });
});
