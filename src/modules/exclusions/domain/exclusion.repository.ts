import { Exclusion } from './exclusion.aggregate';
import { ExclusionImpact, ImpactType } from './exclusion-impact';

export interface ExclusionWithImpacts {
  id: string;
  label: string;
  text: string;
  isStandard: boolean;
  /** Number of warranties this exclusion affects — drives the clickable count badge. */
  affectedCount: number;
  /** IDs of the affected warranties, so the frontend can expand without a second call. */
  warrantyIds: string[];
  /**
   * ISO timestamp of when this exclusion was mapped, or null if never mapped.
   * Derived from the earliest impact's createdAt (impacts are only written by a
   * successful map). Drives the frontend's "N mapped" badge on the table row.
   */
  mappedAt: string | null;
  impacts: { warrantyId: string; spaReference: string; type: ImpactType; rationale: string; confidence: number }[];
}

export interface ExclusionRepository {
  findById(id: string): Promise<Exclusion | null>;
  save(exclusion: Exclusion): Promise<void>;
  replaceImpacts(exclusionId: string, impacts: ExclusionImpact[]): Promise<void>;
  listByDeal(dealId: string): Promise<ExclusionWithImpacts[]>;
}
export const EXCLUSION_REPOSITORY = Symbol('EXCLUSION_REPOSITORY');
