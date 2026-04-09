export type TaxType = 'CPF' | 'CNPJ';

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
