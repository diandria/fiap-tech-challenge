import { buildLogger } from '../../../../src/frameworks/logging/logger';

function capture() {
  const lines: string[] = [];
  return {
    lines,
    stream: { write: (line: string) => { lines.push(line); } },
  };
}

describe('logger', () => {
  it('should emit the semantic resource attributes GIVEN any event WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info('hello');

    const event = JSON.parse(lines[0]);
    expect(event['service.name']).toBe('car-repair-shop-api');
    expect(event['service.version']).toBeDefined();
    expect(event['deployment.environment']).toBeDefined();
    expect(event.msg).toBe('hello');
  });

  it('should emit one valid json object per line GIVEN an event WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info('linha unica');

    expect(lines).toHaveLength(1);
    expect(lines[0].trimEnd().split('\n')).toHaveLength(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('should redact the customer document GIVEN a payload with cpf WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info({ cpf: '12345678909' }, 'auth');

    expect(JSON.parse(lines[0]).cpf).toBe('[Redacted]');
  });

  it('should redact the tax id GIVEN a payload with taxId WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info({ taxId: '12345678909' }, 'customer');

    expect(JSON.parse(lines[0]).taxId).toBe('[Redacted]');
  });

  it('should redact credentials GIVEN a payload with password WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info({ password: 'segredo', passwordHash: 'hash' }, 'login');

    const event = JSON.parse(lines[0]);
    expect(event.password).toBe('[Redacted]');
    expect(event.passwordHash).toBe('[Redacted]');
  });

  it('should redact the authorization header GIVEN a request payload WHEN logging', () => {
    const { lines, stream } = capture();
    buildLogger({ stream }).info(
      { req: { headers: { authorization: 'Bearer abc', 'x-internal-token': 'segredo' } } },
      'request',
    );

    const headers = JSON.parse(lines[0]).req.headers;
    expect(headers.authorization).toBe('[Redacted]');
    expect(headers['x-internal-token']).toBe('[Redacted]');
  });

  it('should honour LOG_LEVEL GIVEN the variable is set WHEN building', () => {
    const previous = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';

    const { lines, stream } = capture();
    const logger = buildLogger({ stream });
    logger.info('nao deve aparecer');
    logger.warn('deve aparecer');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).msg).toBe('deve aparecer');

    process.env.LOG_LEVEL = previous;
  });
});
