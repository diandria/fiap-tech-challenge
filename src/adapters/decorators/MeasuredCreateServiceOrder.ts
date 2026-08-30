import {
  ICreateServiceOrder,
  CreateServiceOrderInput,
} from '../../use-cases/ports/input/ICreateServiceOrder';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { serviceOrdersCreated } from '../../frameworks/metrics/businessMetrics';

export class MeasuredCreateServiceOrder implements ICreateServiceOrder {
  constructor(private readonly inner: ICreateServiceOrder) {}

  async execute(input: CreateServiceOrderInput): Promise<ServiceOrder> {
    const result = await this.inner.execute(input);
    // Depois do await de proposito: se o use case lancar, a linha nao e
    // alcancada e a tentativa falha nao entra na contagem.
    serviceOrdersCreated.inc();
    return result;
  }
}
