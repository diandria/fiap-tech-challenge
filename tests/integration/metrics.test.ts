import request from 'supertest';
import { createTestApp } from '../helpers/testSetup';

describe('GET /metrics', () => {
  it('should expose default process metrics GIVEN a running app WHEN scraped', async () => {
    const res = await request(createTestApp()).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('nodejs_eventloop_lag_seconds');
  });

  // Prometheus scrapes from inside the cluster with no credential: moving this
  // behind authMiddleware takes the target DOWN and only shows an empty panel.
  it('should not require authentication GIVEN no token WHEN scraped', async () => {
    const res = await request(createTestApp()).get('/metrics');

    expect(res.status).not.toBe(401);
  });

  it('should label every metric with the service name GIVEN default labels WHEN scraped', async () => {
    const res = await request(createTestApp()).get('/metrics');

    expect(res.text).toContain('service_name="car-repair-shop-api"');
  });
});
