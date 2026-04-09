# Phase 2 — Core Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRUD for customers, vehicles, services, and items with domain validation (CPF/CNPJ, plate) and stock reservation support on items.

**Architecture:** Each resource follows the same hexagonal slice: domain entity → port interface → use cases → Mongoose model + repository → Express routes. Use cases depend only on port interfaces; no infrastructure imports in `domain/` or `application/`.

**Tech Stack:** TypeScript, Express, Mongoose, Jest (TDD)

**Coverage target:** ≥ 95% across lines, branches, functions, and statements.

**Prerequisite:** Phase 1 complete.

**Branch Strategy:** For each PR go to main branch update and create a new branch

**Pull Strategy:** When finish the PR implementation, push the branch and open a PR (without description)

**PR Strategy:** Keep PRs small and reviewable. Suggested boundaries:
- **PR 2a** — Tasks 1–3 (validators + customer feature)
- **PR 2b** — Tasks 4–5 (vehicle feature)
- **PR 2c** — Task 6 (service feature)
- **PR 2d** — Tasks 7–8 (item feature + stock)
- **PR 2e** — Task 9 (integration tests)

---

## File Map (new files only)

```
src/
  domain/
    entities/
      Customer.ts
      Vehicle.ts
      Service.ts
      Item.ts
    ports/
      ICustomerRepository.ts
      IVehicleRepository.ts
      IServiceRepository.ts
      IItemRepository.ts
    validators.ts
  application/
    use-cases/
      customers/
        CreateCustomerUseCase.ts
        GetCustomerByIdUseCase.ts
        GetCustomerByTaxIdUseCase.ts
        ListCustomersUseCase.ts
        UpdateCustomerUseCase.ts
        DeleteCustomerUseCase.ts
      vehicles/
        CreateVehicleUseCase.ts
        GetVehicleUseCase.ts
        ListVehiclesUseCase.ts
        UpdateVehicleUseCase.ts
        DeleteVehicleUseCase.ts
      services/
        CreateServiceUseCase.ts
        GetServiceUseCase.ts
        ListServicesUseCase.ts
        UpdateServiceUseCase.ts
        DeleteServiceUseCase.ts
      items/
        CreateItemUseCase.ts
        GetItemUseCase.ts
        ListItemsUseCase.ts
        UpdateItemUseCase.ts
        DeleteItemUseCase.ts
  infrastructure/
    persistence/
      models/
        CustomerModel.ts
        VehicleModel.ts
        ServiceModel.ts
        ItemModel.ts
      repositories/
        MongoCustomerRepository.ts
        MongoVehicleRepository.ts
        MongoServiceRepository.ts
        MongoItemRepository.ts
    http/
      routes/
        customerRoutes.ts
        vehicleRoutes.ts
        serviceRoutes.ts
        itemRoutes.ts
tests/
  unit/
    domain/
      validators.test.ts
    application/
      customers/
        CreateCustomerUseCase.test.ts
      vehicles/
        CreateVehicleUseCase.test.ts
      items/
        CreateItemUseCase.test.ts
        DeleteItemUseCase.test.ts
```

---

## Task 1: Domain Validators (TDD)

**Files:**
- Create: `src/domain/validators.ts`
- Create: `tests/unit/domain/validators.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/domain/validators.test.ts`:

```typescript
import { validateCPF, validateCNPJ, validatePlate, validateTaxId, validatePhone } from '../../../src/domain/validators';

describe('validateCPF', () => {
  it('accepts a valid CPF with formatting', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
  });
  it('accepts a valid CPF digits only', () => {
    expect(validateCPF('52998224725')).toBe(true);
  });
  it('rejects wrong first check digit', () => {
    expect(validateCPF('529.982.247-35')).toBe(false);
  });
  it('rejects wrong second check digit', () => {
    expect(validateCPF('529.982.247-24')).toBe(false);
  });
  it('rejects all-same-digit CPF', () => {
    expect(validateCPF('111.111.111-11')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(validateCPF('1234')).toBe(false);
  });
});

describe('validateCNPJ', () => {
  it('accepts a valid CNPJ with formatting', () => {
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
  });
  it('accepts a valid CNPJ digits only', () => {
    expect(validateCNPJ('11222333000181')).toBe(true);
  });
  it('rejects wrong first check digit', () => {
    expect(validateCNPJ('11.222.333/0001-91')).toBe(false);
  });
  it('rejects all-same-digit CNPJ', () => {
    expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(validateCNPJ('1234')).toBe(false);
  });
});

describe('validatePlate', () => {
  it('accepts old format with dash', () => {
    expect(validatePlate('ABC-1234')).toBe(true);
  });
  it('accepts old format without dash', () => {
    expect(validatePlate('ABC1234')).toBe(true);
  });
  it('accepts old format lowercase', () => {
    expect(validatePlate('abc-1234')).toBe(true);
  });
  it('accepts Mercosul format', () => {
    expect(validatePlate('ABC1D23')).toBe(true);
  });
  it('rejects invalid format', () => {
    expect(validatePlate('ABCD123')).toBe(false);
  });
  it('rejects all digits', () => {
    expect(validatePlate('12341234')).toBe(false);
  });
});

describe('validateTaxId', () => {
  it('validates a CPF when type is CPF', () => {
    expect(validateTaxId('529.982.247-25', 'CPF')).toBe(true);
  });
  it('validates a CNPJ when type is CNPJ', () => {
    expect(validateTaxId('11.222.333/0001-81', 'CNPJ')).toBe(true);
  });
  it('rejects a CPF when type is CNPJ', () => {
    expect(validateTaxId('529.982.247-25', 'CNPJ')).toBe(false);
  });
  it('rejects an invalid value', () => {
    expect(validateTaxId('111.111.111-11', 'CPF')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts a valid 11-digit mobile number', () => {
    expect(validatePhone('11999990000')).toBe(true);
  });
  it('accepts a valid 10-digit landline number', () => {
    expect(validatePhone('1133330000')).toBe(true);
  });
  it('accepts formatted numbers', () => {
    expect(validatePhone('(11) 99999-0000')).toBe(true);
  });
  it('rejects less than 10 digits', () => {
    expect(validatePhone('123')).toBe(false);
  });
  it('rejects more than 11 digits', () => {
    expect(validatePhone('119999900001')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest tests/unit/domain/validators.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../src/domain/validators'`

- [ ] **Step 3: Implement `src/domain/validators.ts`**

```typescript
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (slice: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i]) * (factor - i);
    }
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return (
    calcDigit(digits.slice(0, 9), 10) === parseInt(digits[9]) &&
    calcDigit(digits.slice(0, 10), 11) === parseInt(digits[10])
  );
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (slice: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(slice[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  return (
    calcDigit(digits.slice(0, 12), w1) === parseInt(digits[12]) &&
    calcDigit(digits.slice(0, 13), w2) === parseInt(digits[13])
  );
}

export function validatePlate(plate: string): boolean {
  const normalized = plate.toUpperCase().replace(/\s/g, '');
  return (
    /^[A-Z]{3}-?\d{4}$/.test(normalized) ||
    /^[A-Z]{3}\d[A-Z]\d{2}$/.test(normalized)
  );
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

export function validateTaxId(value: string, type: 'CPF' | 'CNPJ'): boolean {
  if (type === 'CPF') return validateCPF(value);
  if (type === 'CNPJ') return validateCNPJ(value);
  return false;
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest tests/unit/domain/validators.test.ts --no-coverage
```

Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/validators.ts tests/unit/domain/validators.test.ts
git commit -m "feat: domain validators for CPF, CNPJ, and plate with TDD"
```

---

## Task 2: Customer — Domain + Use Cases (TDD)

**Files:**
- Create: `src/domain/entities/Customer.ts`
- Create: `src/domain/ports/ICustomerRepository.ts`
- Create: `src/application/use-cases/customers/CreateCustomerUseCase.ts`
- Create: `src/application/use-cases/customers/GetCustomerByIdUseCase.ts`
- Create: `src/application/use-cases/customers/GetCustomerByTaxIdUseCase.ts`
- Create: `src/application/use-cases/customers/ListCustomersUseCase.ts`
- Create: `src/application/use-cases/customers/UpdateCustomerUseCase.ts`
- Create: `src/application/use-cases/customers/DeleteCustomerUseCase.ts`
- Create: `tests/unit/application/customers/CreateCustomerUseCase.test.ts`

- [ ] **Step 1: Create `src/domain/entities/Customer.ts`**

```typescript
export type TaxType = 'CPF' | 'CNPJ';

export interface Customer {
  id: string;
  name: string;
  taxId: string;      // digits only — formatted input stripped on write
  taxType: TaxType;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

- [ ] **Step 2: Create `src/domain/ports/ICustomerRepository.ts`**

```typescript
import { Customer } from '../entities/Customer';

type ManagedFields = 'id' | 'createdAt' | 'updatedAt';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByTaxId(taxId: string): Promise<Customer | null>;
  create(data: Omit<Customer, ManagedFields>): Promise<Customer>;
  update(id: string, data: Partial<Omit<Customer, ManagedFields>>): Promise<Customer | null>;
  softDelete(id: string): Promise<boolean>;
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/application/customers/CreateCustomerUseCase.test.ts`:

```typescript
import { CreateCustomerUseCase } from '../../../../src/application/use-cases/customers/CreateCustomerUseCase';
import { ICustomerRepository } from '../../../../src/domain/ports/ICustomerRepository';
import { Customer } from '../../../../src/domain/entities/Customer';

const validInput = {
  name: 'João Silva',
  taxId: '529.982.247-25',
  taxType: 'CPF' as const,
  email: 'joao@test.com',
  phone: '11999999999',
};

const makeRepo = (override?: Partial<ICustomerRepository>): ICustomerRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByTaxId: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'c-1', ...data, createdAt: new Date(), updatedAt: new Date() })),
  update: jest.fn(),
  softDelete: jest.fn(),
  ...override,
});

describe('CreateCustomerUseCase', () => {
  it('creates a customer with a valid CPF', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('c-1');
    expect(result.taxId).toBe('52998224725'); // formatted input stripped to digits
    expect(result.taxType).toBe('CPF');
  });

  it('creates a customer with a valid CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    const result = await useCase.execute({ ...validInput, taxId: '11.222.333/0001-81', taxType: 'CNPJ' });
    expect(result.id).toBe('c-1');
    expect(result.taxType).toBe('CNPJ');
  });

  it('throws ValidationError for an invalid phone number', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, phone: '123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for an invalid taxType', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, taxType: 'RG' as any }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for an invalid CPF/CNPJ', async () => {
    const useCase = new CreateCustomerUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, taxId: '111.111.111-11' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError if CPF/CNPJ is already registered', async () => {
    const existing: Customer = { id: 'c-2', ...validInput, createdAt: new Date(), updatedAt: new Date() };
    const useCase = new CreateCustomerUseCase(
      makeRepo({ findByTaxId: jest.fn().mockResolvedValue(existing) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
```

- [ ] **Step 4: Run test — verify it fails**

```bash
npx jest tests/unit/application/customers/CreateCustomerUseCase.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement all five Customer use cases**

Create `src/application/use-cases/customers/CreateCustomerUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer, TaxType } from '../../../domain/entities/Customer';
import { validateTaxId, validatePhone } from '../../../domain/validators';
import { ValidationError, ConflictError } from '../../../domain/errors/AppError';

interface CreateCustomerInput {
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
}

export class CreateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    if (input.taxType !== 'CPF' && input.taxType !== 'CNPJ') {
      throw new ValidationError('taxType must be CPF or CNPJ');
    }
    if (!validatePhone(input.phone)) {
      throw new ValidationError('Invalid phone number');
    }
    const normalizedTaxId = input.taxId.replace(/\D/g, '');
    if (!validateTaxId(normalizedTaxId, input.taxType)) {
      throw new ValidationError('Invalid CPF or CNPJ');
    }
    const existing = await this.repo.findByTaxId(normalizedTaxId);
    if (existing) throw new ConflictError('CPF/CNPJ already registered');
    return this.repo.create({ ...input, taxId: normalizedTaxId });
  }
}
```

Create `src/application/use-cases/customers/GetCustomerByIdUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetCustomerByIdUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.repo.findById(id);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
```

Create `src/application/use-cases/customers/GetCustomerByTaxIdUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetCustomerByTaxIdUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(taxId: string): Promise<Customer> {
    const customer = await this.repo.findByTaxId(taxId);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
```

Create `src/application/use-cases/customers/ListCustomersUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';

export class ListCustomersUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(): Promise<Customer[]> {
    return this.repo.findAll();
  }
}
```

Create `src/application/use-cases/customers/UpdateCustomerUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer, TaxType } from '../../../domain/entities/Customer';
import { validateTaxId, validatePhone } from '../../../domain/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/AppError';

export class UpdateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Customer> {
    if (data.taxType !== undefined && !['CPF', 'CNPJ'].includes(data.taxType)) {
      throw new ValidationError('taxType must be CPF or CNPJ');
    }
    if (data.phone !== undefined && !validatePhone(data.phone)) {
      throw new ValidationError('Invalid phone number');
    }
    if (data.taxId !== undefined) {
      const normalizedTaxId = data.taxId.replace(/\D/g, '');
      const taxType: TaxType = data.taxType ?? 'CPF';
      if (!validateTaxId(normalizedTaxId, taxType)) throw new ValidationError('Invalid CPF or CNPJ');
      const existing = await this.repo.findByTaxId(normalizedTaxId);
      if (existing && existing.id !== id) throw new ConflictError('CPF/CNPJ already registered');
      data = { ...data, taxId: normalizedTaxId };
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Customer');
    return updated;
  }
}
```

Create `src/application/use-cases/customers/DeleteCustomerUseCase.ts`:

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { NotFoundError } from '../../../domain/errors/AppError';

export class DeleteCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundError('Customer');
  }
}
```

- [ ] **Step 6: Run test — verify it passes**

```bash
npx jest tests/unit/application/customers/CreateCustomerUseCase.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities/Customer.ts src/domain/ports/ICustomerRepository.ts \
  src/application/use-cases/customers/ \
  tests/unit/application/customers/
git commit -m "feat: Customer entity, port, and use cases with TDD"
```

---

## Task 3: Customer — Infrastructure + Routes

**Files:**
- Create: `src/infrastructure/persistence/models/CustomerModel.ts`
- Create: `src/infrastructure/persistence/repositories/MongoCustomerRepository.ts`
- Create: `src/infrastructure/http/routes/customerRoutes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/infrastructure/persistence/models/CustomerModel.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';
import { TaxType } from '../../../domain/entities/Customer';

interface CustomerDocument extends Document {
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const customerSchema = new Schema<CustomerDocument>({
  name: { type: String, required: true, trim: true },
  taxId: { type: String, required: true, unique: true },
  taxType: { type: String, enum: ['CPF', 'CNPJ'], required: true },
  deletedAt: { type: Date, default: null },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
}, { timestamps: true });

export const CustomerModel = mongoose.model<CustomerDocument>('Customer', customerSchema);
```

- [ ] **Step 2: Create `src/infrastructure/persistence/repositories/MongoCustomerRepository.ts`**

```typescript
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { CustomerModel } from '../models/CustomerModel';

const notDeleted = { deletedAt: null };

export class MongoCustomerRepository implements ICustomerRepository {
  private toEntity(doc: any): Customer {
    return {
      id: doc._id.toString(),
      name: doc.name,
      taxId: doc.taxId,
      taxType: doc.taxType,
      email: doc.email,
      phone: doc.phone,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      ...(doc.deletedAt ? { deletedAt: doc.deletedAt } : {}),
    };
  }

  async findAll(): Promise<Customer[]> {
    const docs = await CustomerModel.find(notDeleted).lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ _id: id, ...notDeleted }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByTaxId(taxId: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ taxId, ...notDeleted }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const doc = await CustomerModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Customer | null> {
    const doc = await CustomerModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      data,
      { new: true },
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await CustomerModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { deletedAt: new Date() },
    );
    return result !== null;
  }
}
```

- [ ] **Step 3: Create `src/infrastructure/http/routes/customerRoutes.ts`**

```typescript
import { Router } from 'express';
import { MongoCustomerRepository } from '../../persistence/repositories/MongoCustomerRepository';
import { CreateCustomerUseCase } from '../../../application/use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from '../../../application/use-cases/customers/GetCustomerByIdUseCase';
import { GetCustomerByTaxIdUseCase } from '../../../application/use-cases/customers/GetCustomerByTaxIdUseCase';
import { ListCustomersUseCase } from '../../../application/use-cases/customers/ListCustomersUseCase';
import { UpdateCustomerUseCase } from '../../../application/use-cases/customers/UpdateCustomerUseCase';
import { DeleteCustomerUseCase } from '../../../application/use-cases/customers/DeleteCustomerUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function customerRoutes(): Router {
  const router = Router();
  const repo = new MongoCustomerRepository();
  const createCustomer = new CreateCustomerUseCase(repo);
  const getCustomerById = new GetCustomerByIdUseCase(repo);
  const getCustomerByTaxId = new GetCustomerByTaxIdUseCase(repo);
  const listCustomers = new ListCustomersUseCase(repo);
  const updateCustomer = new UpdateCustomerUseCase(repo);
  const deleteCustomer = new DeleteCustomerUseCase(repo);

  router.use(authMiddleware);
  router.use(requireRole('attendant', 'admin'));

  /**
   * @openapi
   * /customers:
   *   get:
   *     summary: List all customers
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of customers
   */
  router.get('/', async (req, res, next) => {
    try {
      const customers = await listCustomers.execute();
      res.json(customers);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /customers:
   *   post:
   *     summary: Create a customer
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, taxId, email, phone]
   *             properties:
   *               name: { type: string }
   *               taxId: { type: string }
   *               email: { type: string }
   *               phone: { type: string }
   *     responses:
   *       201:
   *         description: Created customer
   *       400:
   *         description: Invalid CPF/CNPJ
   *       409:
   *         description: CPF/CNPJ already registered
   */
  router.post('/', async (req, res, next) => {
    try {
      const customer = await createCustomer.execute(req.body);
      res.status(201).json(customer);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /customers/tax/{taxId}:
   *   get:
   *     summary: Get a customer by CPF or CNPJ
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: taxId
   *         required: true
   *         schema: { type: string }
   *         description: CPF (11 digits) or CNPJ (14 digits), formatted or raw
   *     responses:
   *       200:
   *         description: Customer object
   *       404:
   *         description: Not found
   */
  // NOTE: /tax/:taxId must be registered BEFORE /:id to prevent Express matching "tax" as an id
  router.get('/tax/:taxId', async (req, res, next) => {
    try {
      const customer = await getCustomerByTaxId.execute(req.params.taxId);
      res.json(customer);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /customers/{id}:
   *   get:
   *     summary: Get a customer by ID
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Customer object
   *       404:
   *         description: Not found
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const customer = await getCustomerById.execute(req.params.id);
      res.json(customer);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /customers/{id}:
   *   put:
   *     summary: Update a customer
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               email: { type: string }
   *               phone: { type: string }
   *     responses:
   *       200:
   *         description: Updated customer
   *       404:
   *         description: Not found
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const customer = await updateCustomer.execute(req.params.id, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /customers/{id}:
   *   delete:
   *     summary: Delete a customer
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteCustomer.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 4: Register customer routes in `src/app.ts`**

Add import at the top:

```typescript
import { customerRoutes } from './infrastructure/http/routes/customerRoutes';
```

Add route registration inside `createApp()`, after `app.use('/auth', authRoutes())`:

```typescript
app.use('/customers', customerRoutes());
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/models/CustomerModel.ts \
  src/infrastructure/persistence/repositories/MongoCustomerRepository.ts \
  src/infrastructure/http/routes/customerRoutes.ts \
  src/app.ts
git commit -m "feat: Customer Mongoose model, repository, and routes"
```

---

## Task 4: Vehicle — Domain + Use Cases (TDD)

**Files:**
- Create: `src/domain/entities/Vehicle.ts`
- Create: `src/domain/ports/IVehicleRepository.ts`
- Create: `src/application/use-cases/vehicles/CreateVehicleUseCase.ts`
- Create: `src/application/use-cases/vehicles/GetVehicleUseCase.ts`
- Create: `src/application/use-cases/vehicles/ListVehiclesUseCase.ts`
- Create: `src/application/use-cases/vehicles/UpdateVehicleUseCase.ts`
- Create: `src/application/use-cases/vehicles/DeleteVehicleUseCase.ts`
- Create: `tests/unit/application/vehicles/CreateVehicleUseCase.test.ts`

- [ ] **Step 1: Create `src/domain/entities/Vehicle.ts`**

```typescript
export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}
```

- [ ] **Step 2: Create `src/domain/ports/IVehicleRepository.ts`**

```typescript
import { Vehicle } from '../entities/Vehicle';

export interface IVehicleRepository {
  findAll(customerId?: string): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  create(data: Omit<Vehicle, 'id'>): Promise<Vehicle>;
  update(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle | null>;
  delete(id: string): Promise<boolean>;
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/application/vehicles/CreateVehicleUseCase.test.ts`:

```typescript
import { CreateVehicleUseCase } from '../../../../src/application/use-cases/vehicles/CreateVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';
import { Vehicle } from '../../../../src/domain/entities/Vehicle';

const validInput = {
  customerId: 'c-1',
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

const makeRepo = (override?: Partial<IVehicleRepository>): IVehicleRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findByPlate: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'v-1', ...data })),
  update: jest.fn(),
  delete: jest.fn(),
  ...override,
});

describe('CreateVehicleUseCase', () => {
  it('creates a vehicle with a valid old-format plate', async () => {
    const useCase = new CreateVehicleUseCase(makeRepo());
    const result = await useCase.execute(validInput);
    expect(result.id).toBe('v-1');
    expect(result.plate).toBe('ABC-1234');
  });

  it('creates a vehicle with a valid Mercosul plate', async () => {
    const useCase = new CreateVehicleUseCase(makeRepo());
    const result = await useCase.execute({ ...validInput, plate: 'ABC1D23' });
    expect(result.id).toBe('v-1');
  });

  it('throws ValidationError for invalid plate format', async () => {
    const useCase = new CreateVehicleUseCase(makeRepo());
    await expect(useCase.execute({ ...validInput, plate: 'INVALID' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError if plate is already registered', async () => {
    const existing: Vehicle = { id: 'v-2', ...validInput };
    const useCase = new CreateVehicleUseCase(
      makeRepo({ findByPlate: jest.fn().mockResolvedValue(existing) }),
    );
    await expect(useCase.execute(validInput))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
```

- [ ] **Step 4: Run test — verify it fails**

```bash
npx jest tests/unit/application/vehicles/CreateVehicleUseCase.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement all five Vehicle use cases**

Create `src/application/use-cases/vehicles/CreateVehicleUseCase.ts`:

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { validatePlate } from '../../../domain/validators';
import { ValidationError, ConflictError } from '../../../domain/errors/AppError';

interface CreateVehicleInput {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}

export class CreateVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(input: CreateVehicleInput): Promise<Vehicle> {
    if (!validatePlate(input.plate)) throw new ValidationError('Invalid plate format');
    const existing = await this.repo.findByPlate(input.plate);
    if (existing) throw new ConflictError('Plate already registered');
    return this.repo.create(input);
  }
}
```

Create `src/application/use-cases/vehicles/GetVehicleUseCase.ts`:

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string): Promise<Vehicle> {
    const vehicle = await this.repo.findById(id);
    if (!vehicle) throw new NotFoundError('Vehicle');
    return vehicle;
  }
}
```

Create `src/application/use-cases/vehicles/ListVehiclesUseCase.ts`:

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';

export class ListVehiclesUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(customerId?: string): Promise<Vehicle[]> {
    return this.repo.findAll(customerId);
  }
}
```

Create `src/application/use-cases/vehicles/UpdateVehicleUseCase.ts`:

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { validatePlate } from '../../../domain/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/AppError';

export class UpdateVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle> {
    if (data.plate !== undefined) {
      if (!validatePlate(data.plate)) throw new ValidationError('Invalid plate format');
      const existing = await this.repo.findByPlate(data.plate);
      if (existing && existing.id !== id) throw new ConflictError('Plate already registered');
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Vehicle');
    return updated;
  }
}
```

Create `src/application/use-cases/vehicles/DeleteVehicleUseCase.ts`:

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { NotFoundError } from '../../../domain/errors/AppError';

export class DeleteVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Vehicle');
  }
}
```

- [ ] **Step 6: Run test — verify it passes**

```bash
npx jest tests/unit/application/vehicles/CreateVehicleUseCase.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities/Vehicle.ts src/domain/ports/IVehicleRepository.ts \
  src/application/use-cases/vehicles/ \
  tests/unit/application/vehicles/
git commit -m "feat: Vehicle entity, port, and use cases with TDD"
```

---

## Task 5: Vehicle — Infrastructure + Routes

**Files:**
- Create: `src/infrastructure/persistence/models/VehicleModel.ts`
- Create: `src/infrastructure/persistence/repositories/MongoVehicleRepository.ts`
- Create: `src/infrastructure/http/routes/vehicleRoutes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/infrastructure/persistence/models/VehicleModel.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';

interface VehicleDocument extends Document {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}

const vehicleSchema = new Schema<VehicleDocument>({
  customerId: { type: String, required: true },
  plate: { type: String, required: true, unique: true, uppercase: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
});

export const VehicleModel = mongoose.model<VehicleDocument>('Vehicle', vehicleSchema);
```

- [ ] **Step 2: Create `src/infrastructure/persistence/repositories/MongoVehicleRepository.ts`**

```typescript
import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { VehicleModel } from '../models/VehicleModel';

export class MongoVehicleRepository implements IVehicleRepository {
  private toEntity(doc: any): Vehicle {
    return {
      id: doc._id.toString(),
      customerId: doc.customerId,
      plate: doc.plate,
      brand: doc.brand,
      model: doc.model,
      year: doc.year,
    };
  }

  async findAll(customerId?: string): Promise<Vehicle[]> {
    const query = customerId ? { customerId } : {};
    const docs = await VehicleModel.find(query).lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Vehicle | null> {
    const doc = await VehicleModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const doc = await VehicleModel.findOne({ plate: plate.toUpperCase() }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const doc = await VehicleModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle | null> {
    const doc = await VehicleModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await VehicleModel.findByIdAndDelete(id);
    return result !== null;
  }
}
```

- [ ] **Step 3: Create `src/infrastructure/http/routes/vehicleRoutes.ts`**

```typescript
import { Router } from 'express';
import { MongoVehicleRepository } from '../../persistence/repositories/MongoVehicleRepository';
import { CreateVehicleUseCase } from '../../../application/use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleUseCase } from '../../../application/use-cases/vehicles/GetVehicleUseCase';
import { ListVehiclesUseCase } from '../../../application/use-cases/vehicles/ListVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../../application/use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../../application/use-cases/vehicles/DeleteVehicleUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function vehicleRoutes(): Router {
  const router = Router();
  const repo = new MongoVehicleRepository();
  const createVehicle = new CreateVehicleUseCase(repo);
  const getVehicle = new GetVehicleUseCase(repo);
  const listVehicles = new ListVehiclesUseCase(repo);
  const updateVehicle = new UpdateVehicleUseCase(repo);
  const deleteVehicle = new DeleteVehicleUseCase(repo);

  router.use(authMiddleware);
  router.use(requireRole('attendant', 'admin'));

  /** @openapi
   * /vehicles:
   *   get:
   *     summary: List vehicles (optionally filter by customerId)
   *     tags: [Vehicles]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: customerId
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Array of vehicles
   */
  router.get('/', async (req, res, next) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const vehicles = await listVehicles.execute(customerId);
      res.json(vehicles);
    } catch (err) { next(err); }
  });

  /** @openapi
   * /vehicles:
   *   post:
   *     summary: Register a vehicle
   *     tags: [Vehicles]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [customerId, plate, brand, model, year]
   *             properties:
   *               customerId: { type: string }
   *               plate: { type: string }
   *               brand: { type: string }
   *               model: { type: string }
   *               year: { type: integer }
   *     responses:
   *       201:
   *         description: Created vehicle
   *       400:
   *         description: Invalid plate format
   *       409:
   *         description: Plate already registered
   */
  router.post('/', async (req, res, next) => {
    try {
      const vehicle = await createVehicle.execute(req.body);
      res.status(201).json(vehicle);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const vehicle = await getVehicle.execute(req.params.id);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const vehicle = await updateVehicle.execute(req.params.id, req.body);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteVehicle.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 4: Register vehicle routes in `src/app.ts`**

Add import:

```typescript
import { vehicleRoutes } from './infrastructure/http/routes/vehicleRoutes';
```

Add after `app.use('/customers', customerRoutes())`:

```typescript
app.use('/vehicles', vehicleRoutes());
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/models/VehicleModel.ts \
  src/infrastructure/persistence/repositories/MongoVehicleRepository.ts \
  src/infrastructure/http/routes/vehicleRoutes.ts \
  src/app.ts
git commit -m "feat: Vehicle Mongoose model, repository, and routes"
```

---

## Task 6: Service — Domain, Use Cases, Infrastructure, Routes

**Files:**
- Create: `src/domain/entities/Service.ts`
- Create: `src/domain/ports/IServiceRepository.ts`
- Create: `src/application/use-cases/services/CreateServiceUseCase.ts`
- Create: `src/application/use-cases/services/GetServiceUseCase.ts`
- Create: `src/application/use-cases/services/ListServicesUseCase.ts`
- Create: `src/application/use-cases/services/UpdateServiceUseCase.ts`
- Create: `src/application/use-cases/services/DeleteServiceUseCase.ts`
- Create: `src/infrastructure/persistence/models/ServiceModel.ts`
- Create: `src/infrastructure/persistence/repositories/MongoServiceRepository.ts`
- Create: `src/infrastructure/http/routes/serviceRoutes.ts`
- Modify: `src/app.ts`

> Service CRUD has no domain-level validation beyond type safety, so the use cases are thin wrappers. Tests are covered by the integration test in Phase 4. No unit test file needed here.

- [ ] **Step 1: Create `src/domain/entities/Service.ts`**

```typescript
export interface Service {
  id: string;
  name: string;
  price: number;
  estimatedMinutes: number;
}
```

- [ ] **Step 2: Create `src/domain/ports/IServiceRepository.ts`**

```typescript
import { Service } from '../entities/Service';

export interface IServiceRepository {
  findAll(): Promise<Service[]>;
  findById(id: string): Promise<Service | null>;
  create(data: Omit<Service, 'id'>): Promise<Service>;
  update(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service | null>;
  delete(id: string): Promise<boolean>;
}
```

- [ ] **Step 3: Implement all five Service use cases**

Create `src/application/use-cases/services/CreateServiceUseCase.ts`:

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

export class CreateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(data: Omit<Service, 'id'>): Promise<Service> {
    return this.repo.create(data);
  }
}
```

Create `src/application/use-cases/services/GetServiceUseCase.ts`:

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string): Promise<Service> {
    const service = await this.repo.findById(id);
    if (!service) throw new NotFoundError('Service');
    return service;
  }
}
```

Create `src/application/use-cases/services/ListServicesUseCase.ts`:

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

export class ListServicesUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(): Promise<Service[]> {
    return this.repo.findAll();
  }
}
```

Create `src/application/use-cases/services/UpdateServiceUseCase.ts`:

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { NotFoundError } from '../../../domain/errors/AppError';

export class UpdateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service> {
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Service');
    return updated;
  }
}
```

Create `src/application/use-cases/services/DeleteServiceUseCase.ts`:

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { NotFoundError } from '../../../domain/errors/AppError';

export class DeleteServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Service');
  }
}
```

- [ ] **Step 4: Create `src/infrastructure/persistence/models/ServiceModel.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';

interface ServiceDocument extends Document {
  name: string;
  price: number;
  estimatedMinutes: number;
}

const serviceSchema = new Schema<ServiceDocument>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  estimatedMinutes: { type: Number, required: true, min: 0 },
});

export const ServiceModel = mongoose.model<ServiceDocument>('Service', serviceSchema);
```

- [ ] **Step 5: Create `src/infrastructure/persistence/repositories/MongoServiceRepository.ts`**

```typescript
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { ServiceModel } from '../models/ServiceModel';

export class MongoServiceRepository implements IServiceRepository {
  private toEntity(doc: any): Service {
    return {
      id: doc._id.toString(),
      name: doc.name,
      price: doc.price,
      estimatedMinutes: doc.estimatedMinutes,
    };
  }

  async findAll(): Promise<Service[]> {
    const docs = await ServiceModel.find().lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Service | null> {
    const doc = await ServiceModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Service, 'id'>): Promise<Service> {
    const doc = await ServiceModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service | null> {
    const doc = await ServiceModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ServiceModel.findByIdAndDelete(id);
    return result !== null;
  }
}
```

- [ ] **Step 6: Create `src/infrastructure/http/routes/serviceRoutes.ts`**

```typescript
import { Router } from 'express';
import { MongoServiceRepository } from '../../persistence/repositories/MongoServiceRepository';
import { CreateServiceUseCase } from '../../../application/use-cases/services/CreateServiceUseCase';
import { GetServiceUseCase } from '../../../application/use-cases/services/GetServiceUseCase';
import { ListServicesUseCase } from '../../../application/use-cases/services/ListServicesUseCase';
import { UpdateServiceUseCase } from '../../../application/use-cases/services/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../../application/use-cases/services/DeleteServiceUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function serviceRoutes(): Router {
  const router = Router();
  const repo = new MongoServiceRepository();
  const createService = new CreateServiceUseCase(repo);
  const getService = new GetServiceUseCase(repo);
  const listServices = new ListServicesUseCase(repo);
  const updateService = new UpdateServiceUseCase(repo);
  const deleteService = new DeleteServiceUseCase(repo);

  // GET /services is public (mechanics need to see catalog without extra roles)
  router.get('/', async (req, res, next) => {
    try {
      const services = await listServices.execute();
      res.json(services);
    } catch (err) { next(err); }
  });

  router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
      const service = await getService.execute(req.params.id);
      res.json(service);
    } catch (err) { next(err); }
  });

  router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await createService.execute(req.body);
      res.status(201).json(service);
    } catch (err) { next(err); }
  });

  router.put('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await updateService.execute(req.params.id, req.body);
      res.json(service);
    } catch (err) { next(err); }
  });

  router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      await deleteService.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 7: Register service routes in `src/app.ts`**

Add import:

```typescript
import { serviceRoutes } from './infrastructure/http/routes/serviceRoutes';
```

Add after `app.use('/vehicles', vehicleRoutes())`:

```typescript
app.use('/services', serviceRoutes());
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/domain/entities/Service.ts src/domain/ports/IServiceRepository.ts \
  src/application/use-cases/services/ \
  src/infrastructure/persistence/models/ServiceModel.ts \
  src/infrastructure/persistence/repositories/MongoServiceRepository.ts \
  src/infrastructure/http/routes/serviceRoutes.ts \
  src/app.ts
git commit -m "feat: Service entity, use cases, model, repository, and routes"
```

---

## Task 7: Item — Domain + Use Cases (TDD)

**Files:**
- Create: `src/domain/entities/Item.ts`
- Create: `src/domain/ports/IItemRepository.ts`
- Create: `src/application/use-cases/items/CreateItemUseCase.ts`
- Create: `src/application/use-cases/items/GetItemUseCase.ts`
- Create: `src/application/use-cases/items/ListItemsUseCase.ts`
- Create: `src/application/use-cases/items/UpdateItemUseCase.ts`
- Create: `src/application/use-cases/items/DeleteItemUseCase.ts`
- Create: `tests/unit/application/items/CreateItemUseCase.test.ts`
- Create: `tests/unit/application/items/DeleteItemUseCase.test.ts`

- [ ] **Step 1: Create `src/domain/entities/Item.ts`**

```typescript
export interface Item {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
}

export function getAvailableQuantity(item: Item): number {
  return item.stockQuantity - item.reservedQuantity;
}
```

- [ ] **Step 2: Create `src/domain/ports/IItemRepository.ts`**

```typescript
import { Item } from '../entities/Item';

export interface IItemRepository {
  findAll(): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  create(data: Omit<Item, 'id'>): Promise<Item>;
  update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null>;
  delete(id: string): Promise<boolean>;
  /** Increment reservedQuantity by quantity */
  reserve(id: string, quantity: number): Promise<Item>;
  /** Decrement reservedQuantity by quantity */
  release(id: string, quantity: number): Promise<Item>;
  /** Decrement both stockQuantity and reservedQuantity by quantity */
  consume(id: string, quantity: number): Promise<Item>;
}
```

- [ ] **Step 3: Write the failing tests**

Create `tests/unit/application/items/CreateItemUseCase.test.ts`:

```typescript
import { CreateItemUseCase } from '../../../../src/application/use-cases/items/CreateItemUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';

const makeRepo = (override?: Partial<IItemRepository>): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'i-1', ...data })),
  update: jest.fn(),
  delete: jest.fn(),
  reserve: jest.fn(),
  release: jest.fn(),
  consume: jest.fn(),
  ...override,
});

describe('CreateItemUseCase', () => {
  it('creates an item with reservedQuantity defaulting to 0', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    const result = await useCase.execute({ name: 'Oil Filter', price: 25.0, stockQuantity: 10 });
    expect(result.reservedQuantity).toBe(0);
    expect(result.stockQuantity).toBe(10);
  });

  it('throws ValidationError for negative stockQuantity', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    await expect(useCase.execute({ name: 'Filter', price: 10, stockQuantity: -1 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for negative price', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    await expect(useCase.execute({ name: 'Filter', price: -5, stockQuantity: 5 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
```

Create `tests/unit/application/items/DeleteItemUseCase.test.ts`:

```typescript
import { DeleteItemUseCase } from '../../../../src/application/use-cases/items/DeleteItemUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { Item } from '../../../../src/domain/entities/Item';

const freeItem: Item = { id: 'i-1', name: 'Filter', price: 10, stockQuantity: 5, reservedQuantity: 0 };
const reservedItem: Item = { id: 'i-2', name: 'Oil', price: 8, stockQuantity: 3, reservedQuantity: 2 };

const makeRepo = (found: Item | null, deleted = true): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue(found),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue(deleted),
  reserve: jest.fn(),
  release: jest.fn(),
  consume: jest.fn(),
});

describe('DeleteItemUseCase', () => {
  it('deletes an item with no reservations', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(freeItem));
    await expect(useCase.execute('i-1')).resolves.toBeUndefined();
  });

  it('throws ValidationError if item has active reservations', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(reservedItem));
    await expect(useCase.execute('i-2'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('reserved') });
  });

  it('throws NotFoundError if item does not exist', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(null));
    await expect(useCase.execute('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 4: Run tests — verify they fail**

```bash
npx jest tests/unit/application/items/ --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 5: Implement all five Item use cases**

Create `src/application/use-cases/items/CreateItemUseCase.ts`:

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item } from '../../../domain/entities/Item';
import { ValidationError } from '../../../domain/errors/AppError';

interface CreateItemInput {
  name: string;
  price: number;
  stockQuantity: number;
}

export class CreateItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(input: CreateItemInput): Promise<Item> {
    if (input.price < 0) throw new ValidationError('Price cannot be negative');
    if (input.stockQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
    return this.repo.create({ ...input, reservedQuantity: 0 });
  }
}
```

Create `src/application/use-cases/items/GetItemUseCase.ts`:

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../../domain/entities/Item';
import { NotFoundError } from '../../../domain/errors/AppError';

export interface ItemWithAvailable extends Item {
  availableQuantity: number;
}

export class GetItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<ItemWithAvailable> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    return { ...item, availableQuantity: getAvailableQuantity(item) };
  }
}
```

Create `src/application/use-cases/items/ListItemsUseCase.ts`:

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { getAvailableQuantity } from '../../../domain/entities/Item';
import { ItemWithAvailable } from './GetItemUseCase';

export class ListItemsUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(): Promise<ItemWithAvailable[]> {
    const items = await this.repo.findAll();
    return items.map((item) => ({ ...item, availableQuantity: getAvailableQuantity(item) }));
  }
}
```

Create `src/application/use-cases/items/UpdateItemUseCase.ts`:

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../../domain/entities/Item';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';
import { ItemWithAvailable } from './GetItemUseCase';

export class UpdateItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string, data: Partial<Pick<Item, 'name' | 'price' | 'stockQuantity'>>): Promise<ItemWithAvailable> {
    if (data.price !== undefined && data.price < 0) throw new ValidationError('Price cannot be negative');
    if (data.stockQuantity !== undefined && data.stockQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Item');
    return { ...updated, availableQuantity: getAvailableQuantity(updated) };
  }
}
```

Create `src/application/use-cases/items/DeleteItemUseCase.ts`:

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class DeleteItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    if (item.reservedQuantity > 0) {
      throw new ValidationError('Cannot delete item with active reservations');
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npx jest tests/unit/application/items/ --no-coverage
```

Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities/Item.ts src/domain/ports/IItemRepository.ts \
  src/application/use-cases/items/ \
  tests/unit/application/items/
git commit -m "feat: Item entity, port, and use cases with TDD (incl. stock guard on delete)"
```

---

## Task 8: Item — Infrastructure + Routes

**Files:**
- Create: `src/infrastructure/persistence/models/ItemModel.ts`
- Create: `src/infrastructure/persistence/repositories/MongoItemRepository.ts`
- Create: `src/infrastructure/http/routes/itemRoutes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/infrastructure/persistence/models/ItemModel.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';

interface ItemDocument extends Document {
  name: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
}

const itemSchema = new Schema<ItemDocument>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
});

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
```

- [ ] **Step 2: Create `src/infrastructure/persistence/repositories/MongoItemRepository.ts`**

```typescript
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item } from '../../../domain/entities/Item';
import { ItemModel } from '../models/ItemModel';
import { NotFoundError } from '../../../domain/errors/AppError';

export class MongoItemRepository implements IItemRepository {
  private toEntity(doc: any): Item {
    return {
      id: doc._id.toString(),
      name: doc.name,
      price: doc.price,
      stockQuantity: doc.stockQuantity,
      reservedQuantity: doc.reservedQuantity,
    };
  }

  async findAll(): Promise<Item[]> {
    const docs = await ItemModel.find().lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Item | null> {
    const doc = await ItemModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    const doc = await ItemModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null> {
    const doc = await ItemModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ItemModel.findByIdAndDelete(id);
    return result !== null;
  }

  async reserve(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { reservedQuantity: quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }

  async release(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { reservedQuantity: -quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }

  async consume(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { stockQuantity: -quantity, reservedQuantity: -quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }
}
```

- [ ] **Step 3: Create `src/infrastructure/http/routes/itemRoutes.ts`**

```typescript
import { Router } from 'express';
import { MongoItemRepository } from '../../persistence/repositories/MongoItemRepository';
import { CreateItemUseCase } from '../../../application/use-cases/items/CreateItemUseCase';
import { GetItemUseCase } from '../../../application/use-cases/items/GetItemUseCase';
import { ListItemsUseCase } from '../../../application/use-cases/items/ListItemsUseCase';
import { UpdateItemUseCase } from '../../../application/use-cases/items/UpdateItemUseCase';
import { DeleteItemUseCase } from '../../../application/use-cases/items/DeleteItemUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function itemRoutes(): Router {
  const router = Router();
  const repo = new MongoItemRepository();
  const createItem = new CreateItemUseCase(repo);
  const getItem = new GetItemUseCase(repo);
  const listItems = new ListItemsUseCase(repo);
  const updateItem = new UpdateItemUseCase(repo);
  const deleteItem = new DeleteItemUseCase(repo);

  router.use(authMiddleware);

  /** @openapi
   * /items:
   *   get:
   *     summary: List all items with available quantity
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of items including availableQuantity
   */
  router.get('/', async (req, res, next) => {
    try {
      const items = await listItems.execute();
      res.json(items);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const item = await getItem.execute(req.params.id);
      res.json(item);
    } catch (err) { next(err); }
  });

  /** @openapi
   * /items:
   *   post:
   *     summary: Create an inventory item (admin only)
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, price, stockQuantity]
   *             properties:
   *               name: { type: string }
   *               price: { type: number, minimum: 0 }
   *               stockQuantity: { type: integer, minimum: 0 }
   *     responses:
   *       201:
   *         description: Created item
   *       400:
   *         description: Validation error
   */
  router.post('/', requireRole('admin'), async (req, res, next) => {
    try {
      const item = await createItem.execute(req.body);
      res.status(201).json(item);
    } catch (err) { next(err); }
  });

  router.put('/:id', requireRole('admin'), async (req, res, next) => {
    try {
      const item = await updateItem.execute(req.params.id, req.body);
      res.json(item);
    } catch (err) { next(err); }
  });

  /** @openapi
   * /items/{id}:
   *   delete:
   *     summary: Delete an item (admin only, fails if stock is reserved)
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       204:
   *         description: Deleted
   *       400:
   *         description: Item has active reservations
   *       404:
   *         description: Not found
   */
  router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
      await deleteItem.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 4: Register item routes in `src/app.ts`**

Add import:

```typescript
import { itemRoutes } from './infrastructure/http/routes/itemRoutes';
```

Add after `app.use('/services', serviceRoutes())`:

```typescript
app.use('/items', itemRoutes());
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence/models/ItemModel.ts \
  src/infrastructure/persistence/repositories/MongoItemRepository.ts \
  src/infrastructure/http/routes/itemRoutes.ts \
  src/app.ts
git commit -m "feat: Item Mongoose model, repository with reserve/release/consume, and routes"
```

---

---

## Task 9: Integration Tests — Customers, Vehicles, Services, Items

**Files:**
- Create: `tests/integration/customers.test.ts`
- Create: `tests/integration/vehicles.test.ts`
- Create: `tests/integration/services.test.ts`
- Create: `tests/integration/items.test.ts`

Each test file bootstraps an admin token via the use case directly (no HTTP round-trip for setup) and then exercises the HTTP layer with Supertest.

- [ ] **Step 1: Create `tests/integration/customers.test.ts`**

```typescript
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let attendantToken: string;

const validCustomer = {
  name: 'João Silva',
  taxId: '529.982.247-25',
  taxType: 'CPF',
  email: 'joao@test.com',
  phone: '11999990000',
};

async function seedTokens(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'attendant@test.com', password: 'attpass', role: 'attendant' });

  const adminRes = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminRes.body.token;

  const attRes = await request(app).post('/auth/login').send({ email: 'attendant@test.com', password: 'attpass' });
  attendantToken = attRes.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
beforeEach(async () => { await seedTokens(); });

describe('POST /customers', () => {
  it('GIVEN a valid CPF WHEN POST /customers as attendant THEN returns 201 with customer data', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${attendantToken}`)
      .send(validCustomer);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.taxId).toBe('52998224725'); // formatted input stripped to digits
  });

  it('GIVEN a valid CNPJ WHEN POST /customers as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validCustomer, taxId: '11.222.333/0001-81', taxType: 'CNPJ' });
    expect(res.status).toBe(201);
  });

  it('GIVEN an invalid CPF WHEN POST /customers THEN returns 400', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${attendantToken}`)
      .send({ ...validCustomer, taxId: '111.111.111-11' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an existing customer WHEN POST /customers with the same CPF/CNPJ THEN returns 409', async () => {
    await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    expect(res.status).toBe(409);
  });

  it('GIVEN no Authorization header WHEN POST /customers THEN returns 401', async () => {
    const res = await request(app).post('/customers').send(validCustomer);
    expect(res.status).toBe(401);
  });
});

describe('GET /customers', () => {
  it('GIVEN one registered customer WHEN GET /customers THEN returns array with one item', async () => {
    await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).get('/customers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('GET /customers/:id', () => {
  it('GIVEN an existing customer WHEN GET /customers/:id THEN returns the customer', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).get(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Silva');
  });

  it('GIVEN a non-existent id WHEN GET /customers/:id THEN returns 404', async () => {
    const res = await request(app).get('/customers/000000000000000000000000').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /customers/:id', () => {
  it('GIVEN an existing customer WHEN PUT /customers/:id with a new name THEN returns 200 with updated data', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app)
      .put(`/customers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'João Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Atualizado');
  });
});

describe('DELETE /customers/:id', () => {
  it('GIVEN an existing customer WHEN DELETE /customers/:id THEN returns 204 AND subsequent GET returns 404', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const del = await request(app).delete(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(404);
  });
});
```

- [ ] **Step 2: Create `tests/integration/vehicles.test.ts`**

```typescript
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;

const validVehicle = {
  customerId: 'c-placeholder',
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

async function seedAdmin(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  const res = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = res.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
beforeEach(async () => { await seedAdmin(); });

describe('POST /vehicles', () => {
  it('GIVEN a valid old-format plate WHEN POST /vehicles as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validVehicle);
    expect(res.status).toBe(201);
    expect(res.body.plate).toBe('ABC-1234');
  });

  it('GIVEN a valid Mercosul plate WHEN POST /vehicles THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle, plate: 'ABC1D23' });
    expect(res.status).toBe(201);
  });

  it('GIVEN an invalid plate format WHEN POST /vehicles THEN returns 400', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle, plate: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an existing vehicle WHEN POST /vehicles with the same plate THEN returns 409', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    expect(res.status).toBe(409);
  });
});

describe('GET /vehicles', () => {
  it('GIVEN one registered vehicle WHEN GET /vehicles THEN returns array with one item', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('GIVEN vehicles for two different customers WHEN GET /vehicles?customerId=c-1 THEN returns only vehicles for c-1', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle, customerId: 'c-1' });
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle, plate: 'XYZ9W87', customerId: 'c-2' });
    const res = await request(app).get('/vehicles?customerId=c-1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].customerId).toBe('c-1');
  });
});

describe('DELETE /vehicles/:id', () => {
  it('GIVEN an existing vehicle WHEN DELETE /vehicles/:id THEN returns 204', async () => {
    const created = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const del = await request(app).delete(`/vehicles/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});
```

- [ ] **Step 3: Create `tests/integration/services.test.ts`**

```typescript
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let mechanicToken: string;

const validService = { name: 'Oil Change', price: 80, estimatedMinutes: 30 };

async function seedTokens(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'mechanic@test.com', password: 'mechpass', role: 'mechanic' });
  const adminRes = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminRes.body.token;
  const mechRes = await request(app).post('/auth/login').send({ email: 'mechanic@test.com', password: 'mechpass' });
  mechanicToken = mechRes.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
beforeEach(async () => { await seedTokens(); });

describe('GET /services', () => {
  it('GIVEN one service in catalog WHEN GET /services without auth THEN returns 200 with array', async () => {
    await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).get('/services');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('POST /services', () => {
  it('GIVEN a valid service payload WHEN POST /services as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validService);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Oil Change');
  });

  it('GIVEN a mechanic token WHEN POST /services THEN returns 403', async () => {
    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send(validService);
    expect(res.status).toBe(403);
  });
});

describe('PUT /services/:id', () => {
  it('GIVEN an existing service WHEN PUT /services/:id with new price as admin THEN returns 200 with updated price', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app)
      .put(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 100 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(100);
  });
});

describe('DELETE /services/:id', () => {
  it('GIVEN an existing service WHEN DELETE /services/:id as admin THEN returns 204', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const del = await request(app).delete(`/services/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});
```

- [ ] **Step 4: Create `tests/integration/items.test.ts`**

```typescript
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';
import { MongoItemRepository } from '../../src/infrastructure/persistence/repositories/MongoItemRepository';

let app: Application;
let adminToken: string;

const validItem = { name: 'Oil Filter', price: 25, stockQuantity: 10 };

async function seedAdmin(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  const res = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = res.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
beforeEach(async () => { await seedAdmin(); });

describe('POST /items', () => {
  it('GIVEN a valid item payload WHEN POST /items as admin THEN returns 201 AND reservedQuantity is 0', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validItem);
    expect(res.status).toBe(201);
    expect(res.body.reservedQuantity).toBe(0);
    expect(res.body.stockQuantity).toBe(10);
  });

  it('GIVEN a negative price WHEN POST /items THEN returns 400', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validItem, price: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /items', () => {
  it('GIVEN one item in inventory WHEN GET /items as admin THEN returns array with availableQuantity computed', async () => {
    await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    const res = await request(app).get('/items').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].availableQuantity).toBe(10);
  });
});

describe('DELETE /items/:id', () => {
  it('GIVEN an item with no reservations WHEN DELETE /items/:id THEN returns 204', async () => {
    const created = await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    const del = await request(app).delete(`/items/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });

  it('GIVEN an item with active reservations WHEN DELETE /items/:id THEN returns 400 with reserved message', async () => {
    const created = await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    // Simulate a reservation directly via the repository
    const itemRepo = new MongoItemRepository();
    await itemRepo.reserve(created.body.id, 3);

    const res = await request(app)
      .delete(`/items/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reserved/i);
  });
});
```

- [ ] **Step 5: Run all integration tests**

```bash
npx jest tests/integration/ --no-coverage
```

Expected: PASS (all integration test files).

- [ ] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tests/integration/customers.test.ts tests/integration/vehicles.test.ts \
  tests/integration/services.test.ts tests/integration/items.test.ts
git commit -m "test: integration tests for customers, vehicles, services, and items"
```

---

## Phase 2 Complete

Run the full suite:

```bash
npm test
```

Expected:
```
PASS tests/unit/domain/validators.test.ts
PASS tests/unit/application/auth/LoginUseCase.test.ts
PASS tests/unit/application/auth/RegisterUseCase.test.ts
PASS tests/unit/application/customers/CreateCustomerUseCase.test.ts
PASS tests/unit/application/vehicles/CreateVehicleUseCase.test.ts
PASS tests/unit/application/items/CreateItemUseCase.test.ts
PASS tests/unit/application/items/DeleteItemUseCase.test.ts
PASS tests/integration/auth.test.ts
PASS tests/integration/customers.test.ts
PASS tests/integration/vehicles.test.ts
PASS tests/integration/services.test.ts
PASS tests/integration/items.test.ts
```

All domain entities, ports, use cases, models, repositories, and routes for `customers`, `vehicles`, `services`, and `items` are in place. Phase 3 builds the Service Order aggregate on top of this foundation.
