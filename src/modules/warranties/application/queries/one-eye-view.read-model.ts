import { CoveragePosition } from '@prisma/client';

/**
 * The four buckets of the WSS "one-eye-view": the three real coverage positions plus an
 * UNMAPPED bucket for warranties that have no decided position AND no AI suggestion yet.
 * These are the columns the reviewer scans at a glance.
 */
export type CoverageBucket = CoveragePosition | 'UNMAPPED';

export const COVERAGE_BUCKETS: readonly CoverageBucket[] = [
  'COVERED',
  'PARTIAL',
  'EXCLUDED',
  'UNMAPPED',
] as const;

/** One warranty as it appears inside a bucket of the one-eye-view. */
export interface OneEyeWarranty {
  id: string;
  spaReference: string;
  title: string;
  /** Which bucket this warranty landed in. */
  bucket: CoverageBucket;
  /** True when the bucket came from a human decision; false when it came from the AI suggestion. */
  decided: boolean;
  /** Seller's-knowledge (or other awareness) qualifier present in the warranty text. */
  hasKnowledgeScrape: boolean;
  /** Materiality qualifier ("in all material respects" / MAE) present in the warranty text. */
  hasMaterialityScrape: boolean;
}

/** Server-computed membership of every bucket, plus counts, for one deal. */
export interface OneEyeViewReadModel {
  dealId: string;
  buckets: Record<CoverageBucket, OneEyeWarranty[]>;
  counts: Record<CoverageBucket, number>;
  total: number;
  /** How many warranties carry a knowledge scrape, across all buckets. */
  knowledgeScrapeCount: number;
  /** How many warranties carry a materiality scrape, across all buckets. */
  materialityScrapeCount: number;
}
