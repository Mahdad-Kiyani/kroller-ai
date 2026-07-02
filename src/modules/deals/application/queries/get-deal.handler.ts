import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetDealQuery, ListDealsQuery } from './get-deal.query';
import { DealReadModel } from './deal.read-model';

@QueryHandler(GetDealQuery)
export class GetDealHandler implements IQueryHandler<GetDealQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(q: GetDealQuery): Promise<DealReadModel> {
    const d = await this.prisma.deal.findUnique({ where: { id: q.id } });
    if (!d) throw new NotFoundException('Deal not found.');
    return { id: d.id, externalRef: d.externalRef, name: d.name, governingLaw: d.governingLaw, createdAt: d.createdAt };
  }
}

@QueryHandler(ListDealsQuery)
export class ListDealsHandler implements IQueryHandler<ListDealsQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(): Promise<DealReadModel[]> {
    const ds = await this.prisma.deal.findMany({ orderBy: { createdAt: 'desc' } });
    return ds.map((d) => ({ id: d.id, externalRef: d.externalRef, name: d.name, governingLaw: d.governingLaw, createdAt: d.createdAt }));
  }
}
