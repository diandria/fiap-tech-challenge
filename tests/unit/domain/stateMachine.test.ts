import { canTransition, assertTransition } from '../../../src/entities/serviceOrderStateMachine';
import { OSStatus } from '../../../src/entities/ServiceOrder';

describe('canTransition', () => {
  const allowed: [OSStatus, OSStatus][] = [
    ['RECEIVED', 'DIAGNOSIS'],
    ['DIAGNOSIS', 'WAITING_APPROVAL'],
    ['WAITING_APPROVAL', 'APPROVED'],
    ['WAITING_APPROVAL', 'REJECTED'],
    ['APPROVED', 'EXECUTION'],
    ['EXECUTION', 'FINISHED'],
    ['FINISHED', 'DELIVERED'],
  ];

  const blocked: [OSStatus, OSStatus][] = [
    ['RECEIVED', 'EXECUTION'],
    ['RECEIVED', 'WAITING_APPROVAL'],
    ['DIAGNOSIS', 'EXECUTION'],
    ['WAITING_APPROVAL', 'EXECUTION'],
    ['WAITING_APPROVAL', 'DIAGNOSIS'],
    ['APPROVED', 'WAITING_APPROVAL'],
    ['EXECUTION', 'RECEIVED'],
    ['FINISHED', 'EXECUTION'],
    ['DELIVERED', 'RECEIVED'],
    ['REJECTED', 'EXECUTION'],
  ];

  allowed.forEach(([from, to]) => {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  });

  blocked.forEach(([from, to]) => {
    it(`blocks ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  });
});

describe('assertTransition', () => {
  it('does not throw for a valid transition', () => {
    expect(() => assertTransition('RECEIVED', 'DIAGNOSIS')).not.toThrow();
  });

  it('throws ValidationError for an invalid transition', () => {
    expect(() => assertTransition('DELIVERED', 'RECEIVED'))
      .toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});

describe('canTransition edge cases', () => {
  it('returns false for an unknown status (runtime safety)', () => {
    expect(canTransition('UNKNOWN' as any, 'DIAGNOSIS')).toBe(false);
  });
});
