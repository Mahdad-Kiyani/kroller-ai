import { Warranty } from './warranty.aggregate';

export interface WarrantyRepository {
  findById(id: string): Promise<Warranty | null>;
  save(warranty: Warranty): Promise<void>;
  saveMany(warranties: Warranty[]): Promise<void>;
  listByDeal(dealId: string): Promise<Warranty[]>;
}
export const WARRANTY_REPOSITORY = Symbol('WARRANTY_REPOSITORY');
