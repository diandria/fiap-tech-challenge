import { IServiceOrderRepository, AvgExecutionResult } from '../ports/IServiceOrderRepository';

export class GetAvgExecutionTimeUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(): Promise<AvgExecutionResult[]> {
    return this.osRepo.getAvgExecutionByService();
  }
}
