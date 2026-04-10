import { UpdateVehicleUseCase } from '../../../../src/application/use-cases/vehicles/UpdateVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/domain/entities/Vehicle';

const vehicle: Vehicle = { id: 'v-1', customerId: 'c-1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 };
const other: Vehicle = { id: 'v-2', customerId: 'c-1', plate: 'XYZ-9999', brand: 'Honda', model: 'Civic', year: 2021 };

const makeRepo = (override?: Partial<IVehicleRepository>): IVehicleRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByPlate: jest.fn().mockResolvedValue(null),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(vehicle),
  delete: jest.fn(),
  ...override,
});

describe('UpdateVehicleUseCase', () => {
  it('updates vehicle without plate change', async () => {
    const repo = makeRepo();
    const useCase = new UpdateVehicleUseCase(repo);
    const result = await useCase.execute('v-1', { brand: 'Ford' });
    expect(repo.findByPlate).not.toHaveBeenCalled();
    expect(result).toEqual(vehicle);
  });

  it('updates plate when valid and not taken by another vehicle', async () => {
    const repo = makeRepo({ findByPlate: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateVehicleUseCase(repo);
    await useCase.execute('v-1', { plate: 'DEF-5678' });
    expect(repo.findByPlate).toHaveBeenCalledWith('DEF-5678');
    expect(repo.update).toHaveBeenCalled();
  });

  it('allows updating to the same plate (same vehicle id)', async () => {
    const repo = makeRepo({ findByPlate: jest.fn().mockResolvedValue(vehicle) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'ABC-1234' })).resolves.toBeDefined();
  });

  it('throws ValidationError for invalid plate format', async () => {
    const repo = makeRepo();
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'INVALID' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError when plate is taken by another vehicle', async () => {
    const repo = makeRepo({ findByPlate: jest.fn().mockResolvedValue(other) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'XYZ-9999' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws NotFoundError when vehicle does not exist', async () => {
    const repo = makeRepo({ update: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('missing', { brand: 'Ford' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
