export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (slice: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i]) * (factor - i);
    }
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return (
    calcDigit(digits.slice(0, 9), 10) === parseInt(digits[9]) &&
    calcDigit(digits.slice(0, 10), 11) === parseInt(digits[10])
  );
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (slice: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(slice[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  return (
    calcDigit(digits.slice(0, 12), w1) === parseInt(digits[12]) &&
    calcDigit(digits.slice(0, 13), w2) === parseInt(digits[13])
  );
}

export function validatePlate(plate: string): boolean {
  const normalized = plate.toUpperCase().replace(/\s/g, '');
  return (
    /^[A-Z]{3}-?\d{4}$/.test(normalized) ||
    /^[A-Z]{3}\d[A-Z]\d{2}$/.test(normalized)
  );
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

export function validateTaxId(value: string, type: 'CPF' | 'CNPJ'): boolean {
  if (type === 'CPF') return validateCPF(value);
  if (type === 'CNPJ') return validateCNPJ(value);
  return false;
}
