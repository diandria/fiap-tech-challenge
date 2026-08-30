import {
  runWithTraceContext,
  getTraceContext,
  outboundTraceHeaders,
} from '../../../../src/frameworks/logging/context';

const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16) };

describe('trace context propagation', () => {
  it('should expose the current context as a traceparent header GIVEN an active scope', () => {
    const headers = runWithTraceContext(ctx, () => outboundTraceHeaders());

    expect(headers).toEqual({ traceparent: `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01` });
  });

  it('should return an empty object GIVEN no active scope', () => {
    expect(outboundTraceHeaders()).toEqual({});
  });

  it('should survive an await GIVEN async code inside the scope', async () => {
    const seen = await runWithTraceContext(ctx, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      return getTraceContext()?.traceId;
    });

    expect(seen).toBe('a'.repeat(32));
  });

  it('should reach code that never saw the request GIVEN an active scope', async () => {
    // Simula um adapter: recebe so os dados de negocio, sem acesso ao objeto de requisicao.
    async function adapterSemRequest(): Promise<string | undefined> {
      await Promise.resolve();
      return getTraceContext()?.traceId;
    }

    const seen = await runWithTraceContext(ctx, () => adapterSemRequest());

    expect(seen).toBe('a'.repeat(32));
  });

  it('should isolate concurrent scopes GIVEN two parallel requests', async () => {
    const first = { traceId: '1'.repeat(32), spanId: 'c'.repeat(16) };
    const second = { traceId: '2'.repeat(32), spanId: 'd'.repeat(16) };

    const [a, b] = await Promise.all([
      runWithTraceContext(first, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getTraceContext()?.traceId;
      }),
      runWithTraceContext(second, async () => {
        return getTraceContext()?.traceId;
      }),
    ]);

    expect(a).toBe('1'.repeat(32));
    expect(b).toBe('2'.repeat(32));
  });
});
