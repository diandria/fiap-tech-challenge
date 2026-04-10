import { validateCPF, validateCNPJ, validatePlate, validateTaxId, validatePhone } from '../../../src/domain/validators';


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

describe('validatePhone', () => {
  it('accepts 10-digit landline (digits only)', () => {
    expect(validatePhone('1133334444')).toBe(true);
  });
  it('accepts 11-digit mobile (digits only)', () => {
    expect(validatePhone('11999998888')).toBe(true);
  });
  it('accepts formatted phone with mask', () => {
    expect(validatePhone('(11) 99999-8888')).toBe(true);
  });
  it('rejects fewer than 10 digits', () => {
    expect(validatePhone('12345')).toBe(false);
  });
  it('rejects more than 11 digits', () => {
    expect(validatePhone('119999988881')).toBe(false);
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
  it('returns false for unknown tax type (runtime safety)', () => {
    expect(validateTaxId('12345', 'OTHER' as any)).toBe(false);
  });
});

describe('validateCPF check-digit edge case', () => {
  // CPF 052.795.490-02: first check digit computation yields rem=10 (>=10), mapping to 0
  it('accepts a valid CPF whose first check digit is 0 (rem >= 10 branch)', () => {
    expect(validateCPF('052.795.490-02')).toBe(true);
  });
});

describe('validateCNPJ check-digit edge case', () => {
  // CNPJ 00.360.305/0001-04: first check digit computation yields rem=0 (<2), mapping to 0
  it('accepts a valid CNPJ whose first check digit is 0 (rem < 2 branch)', () => {
    expect(validateCNPJ('00.360.305/0001-04')).toBe(true);
  });
});
