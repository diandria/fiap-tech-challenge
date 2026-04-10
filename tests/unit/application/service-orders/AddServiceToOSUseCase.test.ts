import { AddServiceToOSUseCase } from '../../../../src/application/use-cases/service-orders/AddServiceToOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';
import { Service } from '../../../../src/domain/entities/Service';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'DIAGNOSIS', services: [], items: [], createdAt: new Date(),
};

const service: Service = { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 };

const makeOSRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
});

const makeServiceRepo = (svc: Service | null): IServiceRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(svc),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('AddServiceToOSUseCase', () => {
  it('adds a service to the OS', async () => {
    const osRepo = makeOSRepo(baseOS);
    const useCase = new AddServiceToOSUseCase(osRepo, makeServiceRepo(service));
    const result = await useCase.execute('os-1', 's-1');
    expect(osRepo.update).toHaveBeenCalledWith('os-1', expect.objectContaining({
      services: [{ serviceId: 's-1' }],
    }));
    expect(result.services).toHaveLength(1);
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new AddServiceToOSUseCase(makeOSRepo(null), makeServiceRepo(service));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when OS is not in DIAGNOSIS status', async () => {
    const wrongOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new AddServiceToOSUseCase(makeOSRepo(wrongOS), makeServiceRepo(service));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when service does not exist', async () => {
    const useCase = new AddServiceToOSUseCase(makeOSRepo(baseOS), makeServiceRepo(null));
    await expect(useCase.execute('os-1', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when service is already added', async () => {
    const osWithService = { ...baseOS, services: [{ serviceId: 's-1' }] };
    const useCase = new AddServiceToOSUseCase(makeOSRepo(osWithService), makeServiceRepo(service));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
