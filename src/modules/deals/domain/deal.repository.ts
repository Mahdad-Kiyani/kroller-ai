import { Deal } from './deal.aggregate';

export interface DealRepository {
  findById(id: string): Promise<Deal | null>;
  findByExternalRef(ref: string): Promise<Deal | null>;
  save(deal: Deal): Promise<void>;
  list(): Promise<Deal[]>;
}
export const DEAL_REPOSITORY = Symbol('DEAL_REPOSITORY');
