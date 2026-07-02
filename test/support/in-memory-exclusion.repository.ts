import { ExclusionRepository, ExclusionWithImpacts } from '@modules/exclusions/domain/exclusion.repository';
import { Exclusion } from '@modules/exclusions/domain/exclusion.aggregate';
import { ExclusionImpact } from '@modules/exclusions/domain/exclusion-impact';

export class InMemoryExclusionRepository implements ExclusionRepository {
  store = new Map<string, Exclusion>();
  impacts = new Map<string, ExclusionImpact[]>();
  async findById(id: string): Promise<Exclusion | null> {
    return this.store.get(id) ?? null;
  }
  async save(e: Exclusion): Promise<void> {
    this.store.set(e.id.toString(), e);
  }
  async replaceImpacts(exclusionId: string, impacts: ExclusionImpact[]): Promise<void> {
    this.impacts.set(exclusionId, impacts);
  }
  async listByDeal(_dealId: string): Promise<ExclusionWithImpacts[]> {
    return [...this.store.values()].map((e) => ({
      id: e.id.toString(), label: e.label, text: e.text, isStandard: e.isStandard,
      impacts: (this.impacts.get(e.id.toString()) ?? []).map((i) => ({
        warrantyId: i.warrantyId, spaReference: '', rationale: i.rationale, confidence: i.confidence,
      })),
    }));
  }
}
