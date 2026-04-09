export interface Item {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
}

export function getAvailableQuantity(item: Item): number {
  return item.stockQuantity - item.reservedQuantity;
}
