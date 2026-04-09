import { CreateVehicleUseCase } from '../../../../src/application/use-cases/vehicles/CreateVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Vehicle } from '../../../../src/domain/entities/Vehicle';
import { Customer } from '../../../../src/domain/entities/Customer';

const validInput = {
  customerId: 'c-1',
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

const existingCustomer: Customer = {
  id: 'c-1',
  name: 'João Silva',
  taxId: '52998224725',
  taxType: 'CPF',
  email: 'joao@test.com',
  phone: '11999999999',
  createdAt: new Date(),
  updatedAt: new Date(),
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

const makeCustomerRepo = (override?: Partial<ICustomerRepository>): ICustomerRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue(existingCustomer),
  findByTaxId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  ...override,
});

describe('CreateVehicleUseCase', () => {
  it('creates a vehicle with a valid old-format plate', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo(), makeCustomerRepo());
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('v-1');
    expect(result.plate).toBe('ABC-1234');
  });

  it('creates a vehicle with a valid Mercosul plate', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo(), makeCustomerRepo());
    const result = await useCase.execute({ ...validInput, plate: 'ABC1D23' });
    expect(result.id).toBe('v-1');
  });

  it('throws NotFoundError if customer does not exist', async () => {
    const useCase = new CreateVehicleUseCase(
      makeVehicleRepo(),
      makeCustomerRepo({ findById: jest.fn().mockResolvedValue(null) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError for invalid plate format', async () => {
    const useCase = new CreateVehicleUseCase(makeVehicleRepo(), makeCustomerRepo());
    await expect(useCase.execute({ ...validInput, plate: 'INVALID' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError if plate is already registered', async () => {
    const existing: Vehicle = { id: 'v-2', ...validInput };
    const useCase = new CreateVehicleUseCase(
      makeVehicleRepo({ findByPlate: jest.fn().mockResolvedValue(existing) }),
      makeCustomerRepo(),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
