import { Prisma } from '@prisma/client';
import { isConnectivityError } from '../../../../src/frameworks/database/isConnectivityError';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: '5.22.0' });
}

describe('isConnectivityError', () => {
  it('should classify an unreachable database as connectivity GIVEN P1001 WHEN checked', () => {
    expect(isConnectivityError(knownError('P1001'))).toBe(true);
  });

  it('should classify a closed connection as connectivity GIVEN P1017 WHEN checked', () => {
    expect(isConnectivityError(knownError('P1017'))).toBe(true);
  });

  it('should classify a failed initialization as connectivity GIVEN the error type WHEN checked', () => {
    const err = new Prisma.PrismaClientInitializationError('boom', '5.22.0');
    expect(isConnectivityError(err)).toBe(true);
  });

  // The distinction that makes the alert worth having: a unique violation is
  // expected application behaviour, not a broken integration. Counting P2xxx
  // would fill the panel with noise and fire the alert over a duplicate tax id.
  it('should not classify a unique constraint violation GIVEN P2002 WHEN checked', () => {
    expect(isConnectivityError(knownError('P2002'))).toBe(false);
  });

  it('should not classify a missing record GIVEN P2025 WHEN checked', () => {
    expect(isConnectivityError(knownError('P2025'))).toBe(false);
  });

  it('should not classify an arbitrary error GIVEN a plain Error WHEN checked', () => {
    expect(isConnectivityError(new Error('qualquer coisa'))).toBe(false);
  });
});
