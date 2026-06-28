import { ServiceOrder } from '../../entities/ServiceOrder';

export interface IBudgetCalculator {
  execute(os: ServiceOrder): Promise<number>;
}
