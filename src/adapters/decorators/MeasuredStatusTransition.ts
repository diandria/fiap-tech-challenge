import { IChangeServiceOrderStatus } from '../../use-cases/ports/input/IChangeServiceOrderStatus';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { observeTimeToStatus } from './observeTimeToStatus';

export class MeasuredStatusTransition implements IChangeServiceOrderStatus {
  constructor(private readonly inner: IChangeServiceOrderStatus) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const result = await this.inner.execute(osId);
    // O status vem do resultado, nao de um parametro do construtor: quem decide
    // para onde a ordem foi e o use case, e transicao recusada lanca antes daqui.
    observeTimeToStatus(result);
    return result;
  }
}
