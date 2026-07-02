/** Outbound port: AI maps an exclusion's text onto the warranties it affects. */
export interface MappableWarranty {
  id: string;
  spaReference: string;
  title: string;
  fullText: string;
}
export interface MappedImpact {
  warrantyId: string;
  rationale: string;
  confidence: number;
}
export interface ExclusionMapperPort {
  map(input: { exclusionText: string; warranties: MappableWarranty[] }): Promise<MappedImpact[]>;
}
export const EXCLUSION_MAPPER = Symbol('EXCLUSION_MAPPER');
