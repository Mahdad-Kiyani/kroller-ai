import { ListWarrantiesByDealHandler, GetWarrantyHandler } from '@modules/warranties/application/queries/list-warranties.handler';
import { ListWarrantiesByDealQuery, GetWarrantyQuery } from '@modules/warranties/application/queries/list-warranties.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const NOW = new Date('2026-01-01T00:00:00Z');

function warranty(id: string, dealId: string, spaReference: string): Record<string, unknown> {
  return {
    id, dealId, spaReference, title: `Warranty ${spaReference}`, fullText: 'text',
    aiCategory: null, aiConfidence: null, category: null, overriddenBy: null,
    aiPosition: null, aiComment: null, aiPositionScore: null,
    decidedPosition: null, decidedBy: null, createdAt: NOW, updatedAt: NOW,
  };
}

function fakePrismaWith(warranties: Array<Record<string, unknown>>): PrismaService {
  return {
    warranty: {
      findMany: async ({
        where,
        orderBy,
        skip,
        take,
      }: {
        where: { dealId: string };
        orderBy?: { spaReference: 'asc' | 'desc' };
        skip?: number;
        take?: number;
      }) => {
        let rows = warranties.filter((w) => w.dealId === where.dealId);
        if (orderBy?.spaReference === 'asc') {
          rows = [...rows].sort((a, b) => {
            const av = a.spaReference as string;
            const bv = b.spaReference as string;
            return av < bv ? -1 : av > bv ? 1 : 0;
          });
        }
        if (skip !== undefined || take !== undefined) {
          rows = rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));
        }
        return rows;
      },
      count: async ({ where }: { where: { dealId: string } }) =>
        warranties.filter((w) => w.dealId === where.dealId).length,
      findUnique: async ({ where }: { where: { id: string } }) =>
        warranties.find((w) => w.id === where.id) ?? null,
    },
  } as unknown as PrismaService;
}

describe('ListWarrantiesByDealHandler / GetWarrantyHandler (integration)', () => {
  const warranties = [
    warranty('w-1', 'deal-1', '2.1'),
    warranty('w-2', 'deal-1', '1.1'),
    warranty('w-3', 'deal-1', '10.2'),
    warranty('w-4', 'deal-2', '1.1'),
  ];

  it('returns the full list, unpaginated, when page/pageSize are omitted', async () => {
    const handler = new ListWarrantiesByDealHandler(fakePrismaWith(warranties));
    const result = await handler.execute(new ListWarrantiesByDealQuery('deal-1'));

    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.totalPages).toBe(1);
    expect(result.data.map((w) => w.spaReference)).toEqual(['1.1', '10.2', '2.1']);
  });

  it('paginates when page/pageSize are given', async () => {
    const handler = new ListWarrantiesByDealHandler(fakePrismaWith(warranties));
    const result = await handler.execute(new ListWarrantiesByDealQuery('deal-1', 1, 2));

    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.data.map((w) => w.spaReference)).toEqual(['1.1', '10.2']);
  });

  it('returns the second (partial) page correctly', async () => {
    const handler = new ListWarrantiesByDealHandler(fakePrismaWith(warranties));
    const result = await handler.execute(new ListWarrantiesByDealQuery('deal-1', 2, 2));

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.data.map((w) => w.spaReference)).toEqual(['2.1']);
  });

  it('returns an empty page past the end without error', async () => {
    const handler = new ListWarrantiesByDealHandler(fakePrismaWith(warranties));
    const result = await handler.execute(new ListWarrantiesByDealQuery('deal-1', 5, 2));

    expect(result.total).toBe(3);
    expect(result.page).toBe(5);
    expect(result.data).toEqual([]);
  });

  it('gets one warranty by id', async () => {
    const handler = new GetWarrantyHandler(fakePrismaWith(warranties));
    const result = await handler.execute(new GetWarrantyQuery('w-1'));
    expect(result.spaReference).toBe('2.1');
  });

  it('throws NotFoundException for an unknown warranty id', async () => {
    const handler = new GetWarrantyHandler(fakePrismaWith(warranties));
    await expect(handler.execute(new GetWarrantyQuery('missing'))).rejects.toThrow('Warranty not found.');
  });
});
