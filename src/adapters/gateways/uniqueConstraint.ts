import { Prisma } from '@prisma/client';
import { ConflictError } from '../../entities/errors/AppError';

const UNIQUE_VIOLATION = 'P2002';

// The column names carry the domain meaning the caller should see. Without the
// mapping the message would leak the physical schema.
const FIELD_LABELS: Record<string, string> = {
  tax_id: 'CPF/CNPJ',
  taxId: 'CPF/CNPJ',
  plate: 'Plate',
  email: 'Email',
};

function labelFor(target: unknown): string {
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  const labels = fields.map((f) => FIELD_LABELS[String(f)]).filter(Boolean);
  return labels.length ? labels.join(', ') : 'Value';
}

/**
 * Turns a unique-constraint violation into a domain ConflictError.
 *
 * A duplicate is a business outcome, not a technical failure. Without this the
 * error reaches the middleware unrecognised and the caller gets a 500, which
 * reads as a broken server rather than an already-registered record. The check
 * in the use case does not cover it: a soft-deleted row keeps its unique value,
 * so the lookup finds nothing and the insert still collides.
 */
export async function translatingUniqueViolation<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
      throw new ConflictError(`${labelFor(err.meta?.target)} already registered`);
    }
    throw err;
  }
}
