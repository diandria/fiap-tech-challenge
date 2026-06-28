export interface IStatusChangeNotifier {
  execute(input: { osId: string }): Promise<void>;
}
