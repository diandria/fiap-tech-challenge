import { ListCustomerVehiclesUseCase } from '../../../../src/application/use-cases/vehicles/ListCustomerVehiclesUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/entities/Vehicle';

const vehicles: Vehicle[] = [
  { id: 'v-1', customerId: 'c-1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 },
];

const makeVehicleRepo = (): IVehicleRepository => ({
  findAll: jest.fn().mockResolvedValue(vehicles),
  findById: jest.fn(), findByPlate: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('ListCustomerVehiclesUseCase', () => {
  it('GIVEN customer with vehicles WHEN execute called THEN returns vehicle array', async () => {
    const repo = makeVehicleRepo();
    const useCase = new ListCustomerVehiclesUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toHaveLength(1);
  });

  it('GIVEN customerId filter WHEN execute called THEN delegates filter to repository', async () => {
    const repo = makeVehicleRepo();
    const useCase = new ListCustomerVehiclesUseCase(repo);
    await useCase.execute('c-1');
    expect(repo.findAll).toHaveBeenCalledWith('c-1');
  });
});
