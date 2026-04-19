import { IServiceOrderRepository, AvgExecutionResult } from '../../../domain/ports/IServiceOrderRepository';

export class GetAvgExecutionTimeUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(): Promise<AvgExecutionResult[]> {
    return this.osRepo.getAvgExecutionByService();
  }
}
