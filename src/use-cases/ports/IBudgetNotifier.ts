export interface IBudgetNotifier {
  execute(input: { osId: string }): Promise<void>;
}
