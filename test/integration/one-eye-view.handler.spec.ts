import { GetOneEyeViewHandler } from '@modules/warranties/application/queries/one-eye-view.handler';
import { GetOneEyeViewQuery } from '@modules/warranties/application/queries/list-warranties.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ScrapeStatus } from '@prisma/client';

interface Row {
  id: string;
  dealId: string;
  spaReference: string;
  title: string;
  fullText: string;
  decidedPosition: 'COVERED' | 'PARTIAL' | 'EXCLUDED' | null;
  aiPosition: 'COVERED' | 'PARTIAL' | 'EXCLUDED' | null;
  // The one-eye-view handler reads the persisted effective scrape status
  // (human override wins, AI detection is the fallback) — never fullText.
  knowledgeScrape: ScrapeStatus;
  materialityScrape: ScrapeStatus;
}

function row(p: Partial<Row> & Pick<Row, 'id' | 'spaReference'>): Row {
  return {
    dealId: 'deal-1',
    title: `Warranty ${p.spaReference}`,
    fullText: 'The Company owns the assets.',
    decidedPosition: null,
    aiPosition: null,
    knowledgeScrape: ScrapeStatus.NO,
    materialityScrape: ScrapeStatus.NO,
    ...p,
  };
}

function fakePrisma(rows: Row[]): PrismaService {
  return {
    warranty: {
      findMany: async ({ where }: { where: { dealId: string } }) => {
        const filtered = rows.filter((r) => r.dealId === where.dealId);
        return [...filtered].sort((a, b) => (a.spaReference < b.spaReference ? -1 : 1));
      },
    },
  } as unknown as PrismaService;
}

describe('GetOneEyeViewHandler (integration)', () => {
  it('places warranties into the four buckets, decided position winning over AI', async () => {
    const rows = [
      row({ id: 'w-1', spaReference: '1.1', decidedPosition: 'COVERED', aiPosition: 'EXCLUDED' }),
      row({ id: 'w-2', spaReference: '1.2', aiPosition: 'PARTIAL' }),
      row({ id: 'w-3', spaReference: '1.3', decidedPosition: 'EXCLUDED' }),
      row({ id: 'w-4', spaReference: '1.4' }), // no decided, no AI → UNMAPPED
    ];
    const handler = new GetOneEyeViewHandler(fakePrisma(rows));
    const view = await handler.execute(new GetOneEyeViewQuery('deal-1'));

    expect(view.counts).toEqual({ COVERED: 1, PARTIAL: 1, EXCLUDED: 1, UNMAPPED: 1 });
    expect(view.total).toBe(4);
    // decided flag: w-1 decided (human), w-2 from AI (not decided).
    expect(view.buckets.COVERED[0]).toMatchObject({ id: 'w-1', decided: true });
    expect(view.buckets.PARTIAL[0]).toMatchObject({ id: 'w-2', decided: false });
    expect(view.buckets.UNMAPPED[0]).toMatchObject({ id: 'w-4', bucket: 'UNMAPPED' });
  });

  it('flags knowledge and materiality scrapes per warranty and totals them', async () => {
    const rows = [
      row({
        id: 'k',
        spaReference: '2.1',
        decidedPosition: 'COVERED',
        fullText: "To the Seller's knowledge, no claims.",
        knowledgeScrape: ScrapeStatus.YES,
      }),
      row({
        id: 'm',
        spaReference: '2.2',
        decidedPosition: 'COVERED',
        fullText: 'True in all material respects.',
        materialityScrape: ScrapeStatus.YES,
      }),
      row({ id: 'clean', spaReference: '2.3', decidedPosition: 'COVERED', fullText: 'The Company owns the assets.' }),
    ];
    const handler = new GetOneEyeViewHandler(fakePrisma(rows));
    const view = await handler.execute(new GetOneEyeViewQuery('deal-1'));

    const covered = view.buckets.COVERED;
    expect(covered.find((w) => w.id === 'k')).toMatchObject({ hasKnowledgeScrape: true, hasMaterialityScrape: false });
    expect(covered.find((w) => w.id === 'm')).toMatchObject({ hasKnowledgeScrape: false, hasMaterialityScrape: true });
    expect(covered.find((w) => w.id === 'clean')).toMatchObject({
      hasKnowledgeScrape: false,
      hasMaterialityScrape: false,
    });
    expect(view.knowledgeScrapeCount).toBe(1);
    expect(view.materialityScrapeCount).toBe(1);
  });

  it('returns all four buckets empty (stable shape) for a deal with no warranties', async () => {
    const handler = new GetOneEyeViewHandler(fakePrisma([]));
    const view = await handler.execute(new GetOneEyeViewQuery('deal-empty'));

    expect(view.total).toBe(0);
    expect(view.counts).toEqual({ COVERED: 0, PARTIAL: 0, EXCLUDED: 0, UNMAPPED: 0 });
    expect(view.buckets.COVERED).toEqual([]);
    expect(view.buckets.UNMAPPED).toEqual([]);
    expect(view.knowledgeScrapeCount).toBe(0);
  });
});
