import { Logger } from 'pino';
import { PinoLoggerAdapter } from '../../../../src/adapters/logging/PinoLoggerAdapter';

function fakePino() {
  const warn: unknown[][] = [];
  const error: unknown[][] = [];
  const logger = {
    warn: (...args: unknown[]) => { warn.push(args); },
    error: (...args: unknown[]) => { error.push(args); },
  } as unknown as Logger;
  return { warn, error, logger };
}

describe('PinoLoggerAdapter', () => {
  it('should forward a warning GIVEN a message and context WHEN warn is called', () => {
    const { warn, logger } = fakePino();

    new PinoLoggerAdapter(logger).warn('customer not found', { osId: 'os-1' });

    expect(warn).toHaveLength(1);
    expect(warn[0][0]).toEqual({ osId: 'os-1' });
    expect(warn[0][1]).toBe('customer not found');
  });

  it('should forward an error GIVEN a message and context WHEN error is called', () => {
    const { error, logger } = fakePino();

    new PinoLoggerAdapter(logger).error('notification failed', { osId: 'os-1' });

    expect(error).toHaveLength(1);
    expect(error[0][1]).toBe('notification failed');
  });

  it('should serialise the cause GIVEN an Error in the context WHEN error is called', () => {
    const { error, logger } = fakePino();
    const cause = new Error('canal fora');

    new PinoLoggerAdapter(logger).error('notification failed', { osId: 'os-1', err: cause });

    const payload = error[0][0] as Record<string, unknown>;
    expect(payload.err).toBe(cause);
  });

  it('should accept a message without context GIVEN only a message WHEN warn is called', () => {
    const { warn, logger } = fakePino();

    new PinoLoggerAdapter(logger).warn('sem contexto');

    expect(warn[0][0]).toEqual({});
    expect(warn[0][1]).toBe('sem contexto');
  });
});
