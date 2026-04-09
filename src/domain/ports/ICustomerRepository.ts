import { Customer } from '../entities/Customer';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByCpfCnpj(cpfCnpj: string): Promise<Customer | null>;
  create(data: Omit<Customer, 'id'>): Promise<Customer>;
  update(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer | null>;
  delete(id: string): Promise<boolean>;
}
