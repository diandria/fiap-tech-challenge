import { Service } from '../../../src/entities/Service';
import { IServiceRepository } from '../../../src/domain/ports/IServiceRepository';

export const baseService: Service = {
  id: 's-1',
  name: 'Oil Change',
  price: 80,
  estimatedMinutes: 30,
};

export const makeServiceRepo = (found: Service | null = baseService): IServiceRepository => ({
  findAll: jest.fn().mockResolvedValue(found ? [found] : []),
  findById: jest.fn().mockResolvedValue(found),
  create: jest.fn().mockResolvedValue(found ?? baseService),
  update: jest.fn().mockImplementation((_id: string, data: Partial<Service>) =>
    Promise.resolve(found ? { ...found, ...data } : null)
  ),
  delete: jest.fn().mockResolvedValue(true),
});
