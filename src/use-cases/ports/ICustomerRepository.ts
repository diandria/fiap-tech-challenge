import { Customer } from '../../entities/Customer';

type ManagedFields = 'id' | 'createdAt' | 'updatedAt';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;
  create(data: Omit<Customer, ManagedFields>): Promise<Customer>;
  update(id: string, data: Partial<Omit<Customer, ManagedFields>>): Promise<Customer | null>;
  softDelete(id: string): Promise<boolean>;
}
