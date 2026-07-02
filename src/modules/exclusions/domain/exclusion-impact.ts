/** AI-produced mapping of an exclusion onto a single warranty. */
export interface ExclusionImpact {
  exclusionId: string;
  warrantyId: string;
  rationale: string;
  confidence: number; // 0..1
}
