import { Service } from '../entities/Service';

export interface IServiceRepository {
  findAll(): Promise<Service[]>;
  findById(id: string): Promise<Service | null>;
  create(data: Omit<Service, 'id'>): Promise<Service>;
  update(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service | null>;
  delete(id: string): Promise<boolean>;
}
