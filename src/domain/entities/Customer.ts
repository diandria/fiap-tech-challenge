export type TaxType = 'CPF' | 'CNPJ';

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  taxType: TaxType;
  deletedAt?: Date;
  email: string;
  phone: string;
}
