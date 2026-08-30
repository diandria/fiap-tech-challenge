import { Customer } from '../../entities/Customer';

type ManagedFields = 'id' | 'createdAt' | 'updatedAt';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;
  /**
   * Inclui clientes removidos. Existe para o lookup de autenticacao, que
   * precisa distinguir "nao existe" de "existe e esta desativado".
   */
  findByTaxIdIncludingInactive(taxId: string): Promise<Customer | null>;
  create(data: Omit<Customer, ManagedFields>): Promise<Customer>;
  update(id: string, data: Partial<Omit<Customer, ManagedFields>>): Promise<Customer | null>;
  softDelete(id: string): Promise<boolean>;
}
