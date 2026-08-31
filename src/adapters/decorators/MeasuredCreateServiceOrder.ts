import {
  ICreateServiceOrder,
  CreateServiceOrderInput,
} from '../../use-cases/ports/input/ICreateServiceOrder';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';

export class MeasuredCreateServiceOrder implements ICreateServiceOrder {
  constructor(
    private readonly inner: ICreateServiceOrder,
    private readonly metrics: IBusinessMetrics,
  ) {}

  async execute(input: CreateServiceOrderInput): Promise<ServiceOrder> {
    const result = await this.inner.execute(input);
    // After the await on purpose: if the use case throws, this line is never
    // reached and the failed attempt does not enter the count.
    this.metrics.serviceOrderCreated();
    return result;
  }
}
