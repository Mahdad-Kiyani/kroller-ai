import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListWarrantiesByDealQuery, GetWarrantyQuery } from './list-warranties.query';
import { WarrantyReadModel } from './warranty.read-model';

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
  async execute(q: ListWarrantiesByDealQuery): Promise<WarrantyReadModel[]> {
    const rows = await this.prisma.warranty.findMany({ where: { dealId: q.dealId }, orderBy: { spaReference: 'asc' } });
    return rows.map(toReadModel);
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
