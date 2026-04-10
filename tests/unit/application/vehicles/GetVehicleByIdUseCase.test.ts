import { GetVehicleByIdUseCase } from '../../../../src/application/use-cases/vehicles/GetVehicleByIdUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/domain/entities/Vehicle';

const vehicle: Vehicle = { id: 'v-1', customerId: 'c-1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 };

const makeRepo = (result: Vehicle | null): IVehicleRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(result),
  findByPlate: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('GetVehicleByIdUseCase', () => {
  it('returns the vehicle when found', async () => {
    const useCase = new GetVehicleByIdUseCase(makeRepo(vehicle));
    const result = await useCase.execute('v-1');
    expect(result.id).toBe('v-1');
  });

  it('throws NotFoundError when vehicle does not exist', async () => {
    const useCase = new GetVehicleByIdUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
