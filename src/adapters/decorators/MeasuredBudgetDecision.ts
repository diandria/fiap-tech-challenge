import { IDecideBudget, DecideBudgetInput } from '../../use-cases/ports/input/IDecideBudget';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { observeTimeToStatus } from './observeTimeToStatus';

export class MeasuredBudgetDecision implements IDecideBudget {
  constructor(private readonly inner: IDecideBudget) {}

  async execute(input: DecideBudgetInput): Promise<ServiceOrder> {
    const result = await this.inner.execute(input);
    observeTimeToStatus(result);
    return result;
  }
}
