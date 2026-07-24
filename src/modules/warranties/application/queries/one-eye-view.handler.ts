import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetOneEyeViewQuery } from './list-warranties.query';
import { ScrapeStatus } from '@prisma/client';
import {
  CoverageBucket,
  COVERAGE_BUCKETS,
  OneEyeViewReadModel,
  OneEyeWarranty,
} from './one-eye-view.read-model';

/** A warranty "has" a scrape when its effective status is confirmed (YES) or partial. */
function isScraped(status: ScrapeStatus): boolean {
  return status === ScrapeStatus.YES || status === ScrapeStatus.PARTIAL;
}

/**
 * Resolves which of the four one-eye-view buckets a warranty belongs to.
 * A human decision (decidedPosition) always wins; otherwise the AI suggestion (aiPosition)
 * places it; with neither, the warranty is UNMAPPED and needs review.
 */
function resolveBucket(w: {
  decidedPosition: OneEyeWarranty['bucket'] | null;
  aiPosition: OneEyeWarranty['bucket'] | null;
}): { bucket: CoverageBucket; decided: boolean } {
  if (w.decidedPosition) return { bucket: w.decidedPosition, decided: true };
  if (w.aiPosition) return { bucket: w.aiPosition, decided: false };
  return { bucket: 'UNMAPPED', decided: false };
}

@QueryHandler(GetOneEyeViewQuery)
export class GetOneEyeViewHandler implements IQueryHandler<GetOneEyeViewQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: GetOneEyeViewQuery): Promise<OneEyeViewReadModel> {
    const rows = await this.prisma.warranty.findMany({
      where: { dealId: q.dealId },
      orderBy: { spaReference: 'asc' },
      select: {
        id: true,
        spaReference: true,
        title: true,
        knowledgeScrape: true,
        materialityScrape: true,
        decidedPosition: true,
        aiPosition: true,
      },
    });

    // Start every bucket empty so the shape is stable even for a deal with no warranties.
    const buckets = Object.fromEntries(
      COVERAGE_BUCKETS.map((b) => [b, [] as OneEyeWarranty[]]),
    ) as Record<CoverageBucket, OneEyeWarranty[]>;

    let knowledgeScrapeCount = 0;
    let materialityScrapeCount = 0;

    for (const w of rows) {
      // Read the persisted effective status (human override wins, AI detection is the
      // fallback) rather than recomputing — so scrape overrides are reflected here.
      const hasKnowledgeScrape = isScraped(w.knowledgeScrape);
      const hasMaterialityScrape = isScraped(w.materialityScrape);
      if (hasKnowledgeScrape) knowledgeScrapeCount += 1;
      if (hasMaterialityScrape) materialityScrapeCount += 1;

      const { bucket, decided } = resolveBucket(w);
      buckets[bucket].push({
        id: w.id,
        spaReference: w.spaReference,
        title: w.title,
        bucket,
        decided,
        hasKnowledgeScrape,
        hasMaterialityScrape,
      });
    }

    const counts = Object.fromEntries(
      COVERAGE_BUCKETS.map((b) => [b, buckets[b].length]),
    ) as Record<CoverageBucket, number>;

    return {
      dealId: q.dealId,
      buckets,
      counts,
      total: rows.length,
      knowledgeScrapeCount,
      materialityScrapeCount,
    };
  }
}
