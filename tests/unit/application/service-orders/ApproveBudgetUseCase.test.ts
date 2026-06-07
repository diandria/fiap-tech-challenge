import { ApproveBudgetUseCase } from '../../../../src/use-cases/service-orders/ApproveBudgetUseCase';
import { makeOSRepo, waitingApprovalOS } from '../../fixtures/serviceOrder';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

describe('ApproveBudgetUseCase', () => {
  it('GIVEN OS WAITING_APPROVAL and correct 4-digit CPF code WHEN execute called THEN transitions to APPROVED', async () => {
    const osRepo = makeOSRepo(waitingApprovalOS);
    const useCase = new ApproveBudgetUseCase(osRepo, makeCustomerRepo(cpfCustomer));
    const result = await useCase.execute('os-1', '5299');
    expect(result.status).toBe('APPROVED');
  });

  it('GIVEN wrong confirmation code WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new ApproveBudgetUseCase(makeOSRepo(waitingApprovalOS), makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('os-1', '0000'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('code') });
  });

  it('GIVEN OS not in WAITING_APPROVAL WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...waitingApprovalOS, status: 'EXECUTION' as const };
    const useCase = new ApproveBudgetUseCase(makeOSRepo(wrongOS), makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('os-1', '5299')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new ApproveBudgetUseCase(makeOSRepo(null), makeCustomerRepo(cpfCustomer));
    await expect(useCase.execute('missing', '5299')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN non-existing customer WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new ApproveBudgetUseCase(makeOSRepo(waitingApprovalOS), makeCustomerRepo(null));
    await expect(useCase.execute('os-1', '5299')).rejects.toMatchObject({ statusCode: 404 });
  });
});
