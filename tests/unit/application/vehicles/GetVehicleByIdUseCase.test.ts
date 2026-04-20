import { GetVehicleByIdUseCase } from '../../../../src/application/use-cases/vehicles/GetVehicleByIdUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/domain/entities/Vehicle';

const vehicle: Vehicle = { id: 'v-1', customerId: 'c-1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 };

const makeVehicleRepo = (result: Vehicle | null): IVehicleRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(result),
  findByPlate: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('GetVehicleByIdUseCase', () => {
  it('GIVEN existing vehicle id WHEN execute called THEN returns the vehicle', async () => {
    const useCase = new GetVehicleByIdUseCase(makeVehicleRepo(vehicle));
    const result = await useCase.execute('v-1');
    expect(result.id).toBe('v-1');
  });

  it('GIVEN unknown id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetVehicleByIdUseCase(makeVehicleRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
