import { WarrantyRepository } from '@modules/warranties/domain/warranty.repository';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';

export class InMemoryWarrantyRepository implements WarrantyRepository {
  store = new Map<string, Warranty>();
  async findById(id: string): Promise<Warranty | null> {
    return this.store.get(id) ?? null;
  }
  async save(w: Warranty): Promise<void> {
    this.store.set(w.id.toString(), w);
  }
  async saveMany(ws: Warranty[]): Promise<void> {
    ws.forEach((w) => this.store.set(w.id.toString(), w));
  }
  async listByDeal(dealId: string): Promise<Warranty[]> {
    return [...this.store.values()].filter((w) => w.dealId === dealId);
  }
}
