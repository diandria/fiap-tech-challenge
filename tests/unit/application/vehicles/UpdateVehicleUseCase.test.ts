import { UpdateVehicleUseCase } from '../../../../src/application/use-cases/vehicles/UpdateVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/entities/Vehicle';

const vehicle: Vehicle = { id: 'v-1', customerId: 'c-1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 };
const other: Vehicle = { id: 'v-2', customerId: 'c-1', plate: 'XYZ-9999', brand: 'Honda', model: 'Civic', year: 2021 };

const makeVehicleRepo = (override?: Partial<IVehicleRepository>): IVehicleRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByPlate: jest.fn().mockResolvedValue(null),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(vehicle),
  delete: jest.fn(),
  ...override,
});

describe('UpdateVehicleUseCase', () => {
  it('GIVEN existing vehicle and no plate change WHEN update called THEN returns updated vehicle without checking plate uniqueness', async () => {
    const repo = makeVehicleRepo();
    const useCase = new UpdateVehicleUseCase(repo);
    const result = await useCase.execute('v-1', { brand: 'Ford' });
    expect(repo.findByPlate).not.toHaveBeenCalled();
    expect(result).toEqual(vehicle);
  });

  it('GIVEN valid new plate not taken WHEN update called THEN updates vehicle', async () => {
    const repo = makeVehicleRepo({ findByPlate: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateVehicleUseCase(repo);
    await useCase.execute('v-1', { plate: 'DEF-5678' });
    expect(repo.findByPlate).toHaveBeenCalledWith('DEF-5678');
    expect(repo.update).toHaveBeenCalled();
  });

  it('GIVEN plate owned by same vehicle WHEN update called THEN resolves successfully', async () => {
    const repo = makeVehicleRepo({ findByPlate: jest.fn().mockResolvedValue(vehicle) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'ABC-1234' })).resolves.toBeDefined();
  });

  it('GIVEN invalid plate format WHEN update called THEN throws ValidationError', async () => {
    const repo = makeVehicleRepo();
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'INVALID' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN plate taken by another vehicle WHEN update called THEN throws ConflictError', async () => {
    const repo = makeVehicleRepo({ findByPlate: jest.fn().mockResolvedValue(other) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('v-1', { plate: 'XYZ-9999' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('GIVEN non-existing vehicle WHEN update called THEN throws NotFoundError', async () => {
    const repo = makeVehicleRepo({ update: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateVehicleUseCase(repo);
    await expect(useCase.execute('missing', { brand: 'Ford' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
