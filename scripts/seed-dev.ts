import 'dotenv/config';
import { prisma, disconnectPrisma } from '../src/frameworks/database/prismaClient';
import { PostgresCustomerRepository } from '../src/adapters/gateways/PostgresCustomerRepository';
import { PostgresVehicleRepository } from '../src/adapters/gateways/PostgresVehicleRepository';
import { PostgresServiceRepository } from '../src/adapters/gateways/PostgresServiceRepository';
import { PostgresItemRepository } from '../src/adapters/gateways/PostgresItemRepository';
import { PostgresUserRepository } from '../src/adapters/gateways/PostgresUserRepository';
import { RegisterUseCase } from '../src/use-cases/auth/RegisterUseCase';
import { ConflictError } from '../src/entities/errors/AppError';
import { UserRole } from '../src/entities/User';
import { CreateCustomerUseCase } from '../src/use-cases/customers/CreateCustomerUseCase';
import { CreateVehicleUseCase } from '../src/use-cases/vehicles/CreateVehicleUseCase';
import { CreateServiceUseCase } from '../src/use-cases/services/CreateServiceUseCase';
import { CreateItemUseCase } from '../src/use-cases/items/CreateItemUseCase';
import { ListServicesUseCase } from '../src/use-cases/services/ListServicesUseCase';
import { ListItemsUseCase } from '../src/use-cases/items/ListItemsUseCase';
import { TaxType } from '../src/entities/Customer';

const DATABASE_URL = process.env.DATABASE_URL || '(nao definido em .env)';

interface SeedCustomer {
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
  vehicles: { plate: string; brand: string; model: string; year: number }[];
}

const SERVICES = [
  { name: 'Oil Change', price: 120, estimatedMinutes: 30 },
  { name: 'Wheel Alignment', price: 80, estimatedMinutes: 45 },
  { name: 'Brake Pad Replacement', price: 220, estimatedMinutes: 90 },
  { name: 'Battery Check', price: 50, estimatedMinutes: 15 },
  { name: 'Engine Tune-up', price: 350, estimatedMinutes: 120 },
];

const ITEMS = [
  { name: '5W30 Synthetic Oil', price: 40, stockQuantity: 30 },
  { name: 'Front Brake Pad Kit', price: 180, stockQuantity: 15 },
  { name: 'Air Filter', price: 35, stockQuantity: 25 },
  { name: 'Battery 60Ah', price: 420, stockQuantity: 8 },
  { name: 'Spark Plug', price: 18, stockQuantity: 60 },
  { name: 'Engine Coolant 1L', price: 25, stockQuantity: 40 },
];

const CUSTOMERS: SeedCustomer[] = [
  {
    name: 'Joao Silva',
    taxId: '52998224725',
    taxType: 'CPF',
    email: 'joao.silva@example.com',
    phone: '11987654321',
    vehicles: [{ plate: 'BRA2E19', brand: 'Volkswagen', model: 'Gol', year: 2019 }],
  },
  {
    name: 'Maria Santos',
    taxId: '11144477735',
    taxType: 'CPF',
    email: 'maria.santos@example.com',
    phone: '11912345678',
    vehicles: [
      { plate: 'CAR1A45', brand: 'Honda', model: 'Civic', year: 2021 },
      { plate: 'VAN9D87', brand: 'Fiat', model: 'Toro', year: 2022 },
    ],
  },
  {
    name: 'Pedro Oliveira',
    taxId: '39053344705',
    taxType: 'CPF',
    email: 'pedro.oliveira@example.com',
    phone: '21998765432',
    vehicles: [{ plate: 'TRK0H22', brand: 'Ford', model: 'Ranger', year: 2020 }],
  },
  {
    name: 'Auto Frota LTDA',
    taxId: '11222333000181',
    taxType: 'CNPJ',
    email: 'frota@autofrota.example.com',
    phone: '1133224455',
    vehicles: [
      { plate: 'BUS6T01', brand: 'Mercedes-Benz', model: 'Sprinter', year: 2018 },
      { plate: 'SUV3J88', brand: 'Toyota', model: 'Hilux', year: 2023 },
      { plate: 'MOT5P34', brand: 'Renault', model: 'Master', year: 2017 },
    ],
  },
];

const USERS: { email: string; password: string; role: UserRole }[] = [
  { email: 'admin@dev.local', password: 'dev123', role: 'admin' },
  { email: 'attendant@dev.local', password: 'dev123', role: 'attendant' },
  { email: 'mechanic@dev.local', password: 'dev123', role: 'mechanic' },
];

interface Result {
  created: number;
  skipped: number;
}

async function seedServices(): Promise<Result> {
  const repo = new PostgresServiceRepository(prisma);
  const list = new ListServicesUseCase(repo);
  const create = new CreateServiceUseCase(repo);
  const existing = await list.execute();
  const existingNames = new Set(existing.map((s) => s.name));
  let created = 0;
  let skipped = 0;
  for (const data of SERVICES) {
    if (existingNames.has(data.name)) {
      skipped += 1;
      continue;
    }
    await create.execute(data);
    created += 1;
  }
  return { created, skipped };
}

async function seedItems(): Promise<Result> {
  const repo = new PostgresItemRepository(prisma);
  const list = new ListItemsUseCase(repo);
  const create = new CreateItemUseCase(repo);
  const existing = await list.execute();
  const existingNames = new Set(existing.map((i) => i.name));
  let created = 0;
  let skipped = 0;
  for (const data of ITEMS) {
    if (existingNames.has(data.name)) {
      skipped += 1;
      continue;
    }
    await create.execute(data);
    created += 1;
  }
  return { created, skipped };
}

async function seedCustomersAndVehicles(): Promise<{ customers: Result; vehicles: Result }> {
  const customerRepo = new PostgresCustomerRepository(prisma);
  const vehicleRepo = new PostgresVehicleRepository(prisma);
  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createVehicle = new CreateVehicleUseCase(vehicleRepo);

  const customers: Result = { created: 0, skipped: 0 };
  const vehicles: Result = { created: 0, skipped: 0 };

  for (const seed of CUSTOMERS) {
    let customerId: string;
    const existingCustomer = await customerRepo.findByTaxId(seed.taxId);
    if (existingCustomer) {
      customerId = existingCustomer.id;
      customers.skipped += 1;
    } else {
      const created = await createCustomer.execute({
        name: seed.name,
        taxId: seed.taxId,
        taxType: seed.taxType,
        email: seed.email,
        phone: seed.phone,
      });
      customerId = created.id;
      customers.created += 1;
    }

    for (const v of seed.vehicles) {
      const existingVehicle = await vehicleRepo.findByPlate(v.plate);
      if (existingVehicle) {
        vehicles.skipped += 1;
        continue;
      }
      await createVehicle.execute({ ...v, customerId });
      vehicles.created += 1;
    }
  }

  return { customers, vehicles };
}

async function seedUsers(): Promise<Result> {
  const repo = new PostgresUserRepository(prisma);
  const register = new RegisterUseCase(repo);
  let created = 0;
  let skipped = 0;
  for (const data of USERS) {
    try {
      await register.execute(data);
      created += 1;
    } catch (err) {
      if (err instanceof ConflictError) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }
  return { created, skipped };
}

function summarize(label: string, r: Result): void {
  console.log(`  ${label}: ${r.created} created, ${r.skipped} skipped`);
}

async function main(): Promise<void> {
  console.log(`Connecting to ${DATABASE_URL.replace(/:\/\/[^@]*@/, '://***@')}`);
  await prisma.$connect();
  try {
    console.log('Seeding services...');
    summarize('services', await seedServices());

    console.log('Seeding items...');
    summarize('items', await seedItems());

    console.log('Seeding customers and vehicles...');
    const { customers, vehicles } = await seedCustomersAndVehicles();
    summarize('customers', customers);
    summarize('vehicles', vehicles);

    console.log('Seeding users...');
    summarize('users', await seedUsers());
    console.log('WARNING: dev seed users use weak password "dev123" — never run this in production');

    console.log('Done.');
  } finally {
    await disconnectPrisma();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
