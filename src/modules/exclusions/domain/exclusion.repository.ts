import { Exclusion } from './exclusion.aggregate';
import { ExclusionImpact } from './exclusion-impact';

export interface ExclusionWithImpacts {
  id: string;
  label: string;
  text: string;
  isStandard: boolean;
  impacts: { warrantyId: string; spaReference: string; rationale: string; confidence: number }[];
}

export interface ExclusionRepository {
  findById(id: string): Promise<Exclusion | null>;
  save(exclusion: Exclusion): Promise<void>;
  replaceImpacts(exclusionId: string, impacts: ExclusionImpact[]): Promise<void>;
  listByDeal(dealId: string): Promise<ExclusionWithImpacts[]>;
}
export const EXCLUSION_REPOSITORY = Symbol('EXCLUSION_REPOSITORY');
