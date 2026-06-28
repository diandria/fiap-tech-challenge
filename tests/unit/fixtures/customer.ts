import { Customer } from '../../../src/entities/Customer';
import { ICustomerRepository } from '../../../src/use-cases/ports/ICustomerRepository';

// CPF 52998224725 → first 4 digits: "5299"
export const cpfCustomer: Customer = {
  id: 'c-1',
  name: 'John Smith',
  taxId: '52998224725',
  taxType: 'CPF',
  email: 'john@test.com',
  phone: '11999999999',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// CNPJ 11222333000181 → first 4 digits: "1122"
export const cnpjCustomer: Customer = {
  id: 'c-2',
  name: 'Acme Corp',
  taxId: '11222333000181',
  taxType: 'CNPJ',
  email: 'empresa@test.com',
  phone: '1133333333',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const makeCustomerRepo = (found: Customer | null = cpfCustomer): ICustomerRepository => ({
  findAll: jest.fn().mockResolvedValue(found ? [found] : []),
  findById: jest.fn().mockResolvedValue(found),
  findByTaxId: jest.fn().mockResolvedValue(found),
  create: jest.fn().mockResolvedValue(found ?? cpfCustomer),
  update: jest.fn().mockImplementation((_id: string, data: Partial<Customer>) =>
    Promise.resolve(found ? { ...found, ...data } : null)
  ),
  softDelete: jest.fn().mockResolvedValue(true),
});
