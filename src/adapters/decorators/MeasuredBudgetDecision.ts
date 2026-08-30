import { IDecideBudget } from '../../use-cases/ports/input/IDecideBudget';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { observeTimeToStatus } from './observeTimeToStatus';

export class MeasuredBudgetDecision implements IDecideBudget {
  constructor(private readonly inner: IDecideBudget) {}

  async execute(osId: string, code: string): Promise<ServiceOrder> {
    const result = await this.inner.execute(osId, code);
    observeTimeToStatus(result);
    return result;
  }
}
