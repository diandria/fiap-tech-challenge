import http from 'k6/http';
import { check } from 'k6';

// BASE_URL: API under test (default: K8s LoadBalancer via minikube tunnel)
// OS_ID: optional service order id — adds a DB-backed public read to the mix
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const OS_ID = __ENV.OS_ID || '';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // ramp up
        { duration: '3m', target: 100 },  // sustained load — HPA should scale out here
        { duration: '30s', target: 0 },   // ramp down — replicas shrink after stabilization window
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health is 200': (r) => r.status === 200 });

  if (OS_ID) {
    const status = http.get(`${BASE_URL}/service-orders/${OS_ID}/status`);
    check(status, { 'os status is 200': (r) => r.status === 200 });
  }
}
