import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListWarrantiesByDealQuery, GetWarrantyQuery } from './list-warranties.query';
import { WarrantyReadModel } from './warranty.read-model';
import { PaginatedResult } from './paginated-result';

const DEFAULT_PAGE_SIZE = 20;

function toReadModel(w: {
  id: string; dealId: string; spaReference: string; title: string;
  aiCategory: WarrantyReadModel['aiCategory']; aiConfidence: number | null;
  category: WarrantyReadModel['category']; overriddenBy: string | null;
  aiPosition: WarrantyReadModel['aiPosition']; aiComment: string | null; aiPositionScore: number | null;
  decidedPosition: WarrantyReadModel['decidedPosition']; decidedBy: string | null;
}): WarrantyReadModel {
  return {
    id: w.id, dealId: w.dealId, spaReference: w.spaReference, title: w.title,
    aiCategory: w.aiCategory, aiConfidence: w.aiConfidence, category: w.category,
    overridden: w.overriddenBy !== null,
    needsReview: w.aiConfidence === null || w.aiConfidence < 0.7,
    aiPosition: w.aiPosition, aiComment: w.aiComment, aiPositionScore: w.aiPositionScore,
    decidedPosition: w.decidedPosition, decidedBy: w.decidedBy,
  };
}

@QueryHandler(ListWarrantiesByDealQuery)
export class ListWarrantiesByDealHandler implements IQueryHandler<ListWarrantiesByDealQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(q: ListWarrantiesByDealQuery): Promise<PaginatedResult<WarrantyReadModel>> {
    const where = { dealId: q.dealId };
    // Pagination is opt-in: pass page and/or pageSize to paginate, or omit both for the full list
    // (e.g. dashboard-style aggregate stats that need every warranty on the deal at once).
    const paginate = q.page !== undefined || q.pageSize !== undefined;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;

    const [rows, total] = await Promise.all([
      this.prisma.warranty.findMany({
        where,
        orderBy: { spaReference: 'asc' },
        ...(paginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
      this.prisma.warranty.count({ where }),
    ]);
    const data = rows.map(toReadModel);

    if (!paginate) return { data, total, page: 1, pageSize: total, totalPages: 1 };
    return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}

@QueryHandler(GetWarrantyQuery)
export class GetWarrantyHandler implements IQueryHandler<GetWarrantyQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(q: GetWarrantyQuery): Promise<WarrantyReadModel> {
    const w = await this.prisma.warranty.findUnique({ where: { id: q.id } });
    if (!w) throw new NotFoundException('Warranty not found.');
    return toReadModel(w);
  }
}
