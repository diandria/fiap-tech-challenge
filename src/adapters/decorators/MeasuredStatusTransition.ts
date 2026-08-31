import { IChangeServiceOrderStatus } from '../../use-cases/ports/input/IChangeServiceOrderStatus';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';
import { observeTimeToStatus } from './observeTimeToStatus';

export class MeasuredStatusTransition implements IChangeServiceOrderStatus {
  constructor(
    private readonly inner: IChangeServiceOrderStatus,
    private readonly metrics: IBusinessMetrics,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const result = await this.inner.execute(osId);
    // The status comes from the result, not from a constructor argument: the
    // use case decides where the order went, and a rejected transition throws
    // before reaching this line.
    observeTimeToStatus(result, this.metrics);
    return result;
  }
}
