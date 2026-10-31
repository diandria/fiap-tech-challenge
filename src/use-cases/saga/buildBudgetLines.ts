import { ServiceOrder } from '../../entities/ServiceOrder';
import { Service } from '../../entities/Service';
import { Item } from '../../entities/Item';
import { NotFoundError } from '../../entities/errors/AppError';
import { BudgetLine } from './messages';

/**
 * The priced lines of an order, as the catalog has them now: each service once,
 * each item at the quantity ordered. The Billing Service keeps this snapshot,
 * so a later price change does not alter a budget already sent. An entry that
 * left the catalog is a data inconsistency, and the reply has to fail.
 */
export function buildBudgetLines(order: ServiceOrder, services: Service[], items: Item[]): BudgetLine[] {
  const serviceLines = order.services.map(({ serviceId }): BudgetLine => {
    const service = services.find((candidate) => candidate.id === serviceId);
    if (!service) throw new NotFoundError(`Service ${serviceId}`);
    return { kind: 'SERVICE', referenceId: service.id, description: service.name, unitPrice: service.price, quantity: 1 };
  });

  const itemLines = order.items.map(({ itemId, quantity }): BudgetLine => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundError(`Item ${itemId}`);
    return { kind: 'ITEM', referenceId: item.id, description: item.name, unitPrice: item.price, quantity };
  });

  return [...serviceLines, ...itemLines];
}
