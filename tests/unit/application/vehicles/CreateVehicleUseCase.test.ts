import { CreateVehicleUseCase } from '../../../../src/application/use-cases/vehicles/CreateVehicleUseCase';
import { IVehicleRepository } from '../../../../src/use-cases/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/entities/Vehicle';

const validInput = {
  customerId: 'c-1',
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

const makeVehicleRepo = (override?: Partial<IVehicleRepository>): IVehicleRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByPlate: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'v-1', ...data })),
  update: jest.fn(),
  delete: jest.fn(),
  ...override,
});

describe('CreateVehicleUseCase', () => {
  it('GIVEN valid vehicle data WHEN execute called THEN returns created vehicle', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo());
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('v-1');
    expect(result.plate).toBe('ABC-1234');
  });

  it('GIVEN valid Mercosul plate WHEN execute called THEN returns created vehicle', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo());
    const result = await useCase.execute({ ...validInput, plate: 'ABC1D23' });
    expect(result.id).toBe('v-1');
  });

  it('GIVEN invalid plate format WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo());
    await expect(useCase.execute({ ...validInput, plate: 'INVALID' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN duplicate plate WHEN execute called THEN throws ConflictError', async () => {
    const existing: Vehicle = { id: 'v-2', ...validInput };
    const useCase = new CreateVehicleUseCase(
      makeVehicleRepo({ findByPlate: jest.fn().mockResolvedValue(existing) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
