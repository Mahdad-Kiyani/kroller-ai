import { DealRepository } from '@modules/deals/domain/deal.repository';
import { Deal } from '@modules/deals/domain/deal.aggregate';

export class InMemoryDealRepository implements DealRepository {
  store = new Map<string, Deal>();
  async findById(id: string): Promise<Deal | null> {
    return this.store.get(id) ?? null;
  }
  async findByExternalRef(ref: string): Promise<Deal | null> {
    return [...this.store.values()].find((d) => d.externalRef === ref) ?? null;
  }
  async save(deal: Deal): Promise<void> {
    this.store.set(deal.id.toString(), deal);
  }
  async list(): Promise<Deal[]> {
    return [...this.store.values()];
  }
}
