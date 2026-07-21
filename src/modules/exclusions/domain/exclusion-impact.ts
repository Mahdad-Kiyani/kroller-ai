/**
 * Coverage-effect of an exclusion on a warranty:
 * - FULL: exclusion wholly removes the warranty's coverage.
 * - PARTIAL: exclusion limits/reduces coverage but does not remove it.
 * - CARVE_OUT: exclusion removes a specific case while the warranty otherwise stands.
 */
export type ImpactType = 'FULL' | 'PARTIAL' | 'CARVE_OUT';
export const IMPACT_TYPES: readonly ImpactType[] = ['FULL', 'PARTIAL', 'CARVE_OUT'] as const;

/** Fallback when the AI omits or returns an unrecognised type. */
export const DEFAULT_IMPACT_TYPE: ImpactType = 'PARTIAL';

/** Coerce arbitrary AI output to a valid ImpactType, defaulting rather than throwing. */
export function coerceImpactType(value: unknown): ImpactType {
  const upper = String(value ?? '').toUpperCase();
  return (IMPACT_TYPES as readonly string[]).includes(upper) ? (upper as ImpactType) : DEFAULT_IMPACT_TYPE;
}

/** AI-produced mapping of an exclusion onto a single warranty. */
export interface ExclusionImpact {
  exclusionId: string;
  warrantyId: string;
  type: ImpactType;
  rationale: string;
  confidence: number; // 0..1
}
