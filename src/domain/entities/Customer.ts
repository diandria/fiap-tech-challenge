export interface Customer {
  id: string;
  name: string;
  taxId: string;
  taxType: 'CPF' | 'CNPJ';
  deletedAt?: Date;
  email: string;
  phone: string;
}
