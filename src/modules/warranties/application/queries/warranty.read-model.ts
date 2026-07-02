import { WarrantyCategory, CoveragePosition } from '@prisma/client';
export interface WarrantyReadModel {
  id: string;
  dealId: string;
  spaReference: string;
  title: string;
  aiCategory: WarrantyCategory | null;
  aiConfidence: number | null;
  category: WarrantyCategory | null;
  overridden: boolean;
  needsReview: boolean;
  aiPosition: CoveragePosition | null;
  aiComment: string | null;
  aiPositionScore: number | null;
  decidedPosition: CoveragePosition | null;
  decidedBy: string | null;
}
