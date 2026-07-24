import { WarrantyCategory, CoveragePosition, ScrapeStatus } from '@prisma/client';
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
  /** Effective knowledge-scrape status (human override wins, AI detection is the fallback). */
  knowledgeScrape: ScrapeStatus;
  /** Effective materiality-scrape status (human override wins, AI detection is the fallback). */
  materialityScrape: ScrapeStatus;
  /** Raw AI knowledge-scrape detection, preserved even after a human override. */
  aiKnowledgeScrape: ScrapeStatus;
  /** Raw AI materiality-scrape detection, preserved even after a human override. */
  aiMaterialityScrape: ScrapeStatus;
  /** Verbatim qualifier phrase the AI flagged as a knowledge scrape, if any. */
  aiKnowledgeScrapeText: string | null;
  /** Verbatim qualifier phrase the AI flagged as a materiality scrape, if any. */
  aiMaterialityScrapeText: string | null;
  /** True when a human overrode the AI scrape detection. */
  scrapesOverridden: boolean;
}
