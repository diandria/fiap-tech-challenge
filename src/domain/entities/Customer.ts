export interface Customer {
  id: string;
  name: string;
  taxId: string;
  taxType: 'CPF' | 'CNPJ';
  email: string;
  phone: string;
}
