import { Customer } from '../entities/Customer';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;
  findByTaxType(taxType: 'CPF' | 'CNPJ'): Promise<Customer[]>;
  create(data: Omit<Customer, 'id'>): Promise<Customer>;
  update(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer | null>;
  softDelete(id: string): Promise<boolean>;
}
