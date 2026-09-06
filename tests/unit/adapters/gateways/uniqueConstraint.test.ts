import { Prisma } from '@prisma/client';
import { translatingUniqueViolation } from '../../../../src/adapters/gateways/uniqueConstraint';
import { ConflictError } from '../../../../src/entities/errors/AppError';

const uniqueViolation = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

describe('translatingUniqueViolation', () => {
  it('should return the value GIVEN no error WHEN the operation succeeds', async () => {
    await expect(translatingUniqueViolation(async () => 'ok')).resolves.toBe('ok');
  });

  // A duplicate is a business outcome. Left untranslated it reaches the error
  // middleware unrecognised and the caller gets a 500 instead of a 409.
  it('should throw ConflictError GIVEN a unique violation WHEN the operation runs', async () => {
    await expect(
      translatingUniqueViolation(async () => {
        throw uniqueViolation(['tax_id']);
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('should name the field GIVEN a tax id violation WHEN translating', async () => {
    await expect(
      translatingUniqueViolation(async () => {
        throw uniqueViolation(['tax_id']);
      }),
    ).rejects.toThrow('CPF/CNPJ already registered');
  });

  it('should name the field GIVEN a plate violation WHEN translating', async () => {
    await expect(
      translatingUniqueViolation(async () => {
        throw uniqueViolation(['plate']);
      }),
    ).rejects.toThrow('Plate already registered');
  });

  it('should accept a string target GIVEN the driver reports one field WHEN translating', async () => {
    await expect(
      translatingUniqueViolation(async () => {
        throw uniqueViolation('email');
      }),
    ).rejects.toThrow('Email already registered');
  });

  // An unmapped column must not leak the physical schema into the response.
  it('should fall back to a generic label GIVEN an unmapped column WHEN translating', async () => {
    await expect(
      translatingUniqueViolation(async () => {
        throw uniqueViolation(['some_internal_column']);
      }),
    ).rejects.toThrow('Value already registered');
  });

  // Only P2002 is a conflict. Every other Prisma failure keeps its own meaning.
  it('should rethrow untouched GIVEN a different prisma error WHEN the operation runs', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    await expect(
      translatingUniqueViolation(async () => {
        throw other;
      }),
    ).rejects.toBe(other);
  });

  it('should rethrow untouched GIVEN a plain error WHEN the operation runs', async () => {
    const boom = new Error('boom');
    await expect(
      translatingUniqueViolation(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
