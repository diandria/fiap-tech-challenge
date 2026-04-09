import { canTransition, assertTransition } from '../../../src/domain/serviceOrderStateMachine';
import { OSStatus } from '../../../src/domain/entities/ServiceOrder';

describe('canTransition', () => {
  const allowed: [OSStatus, OSStatus][] = [
    ['RECEIVED', 'DIAGNOSIS'],
    ['DIAGNOSIS', 'WAITING_APPROVAL'],
    ['WAITING_APPROVAL', 'EXECUTION'],
    ['WAITING_APPROVAL', 'REJECTED'],
    ['EXECUTION', 'FINISHED'],
    ['FINISHED', 'DELIVERED'],
  ];

  const blocked: [OSStatus, OSStatus][] = [
    ['RECEIVED', 'EXECUTION'],
    ['RECEIVED', 'WAITING_APPROVAL'],
    ['DIAGNOSIS', 'EXECUTION'],
    ['WAITING_APPROVAL', 'DIAGNOSIS'],
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
