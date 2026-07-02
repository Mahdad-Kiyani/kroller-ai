import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { DealRepository } from '../domain/deal.repository';
import { Deal } from '../domain/deal.aggregate';

@Injectable()
export class PrismaDealRepository implements DealRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: { id: string; externalRef: string; name: string; governingLaw: string | null }): Deal {
    return Deal.reconstitute(r.id, { externalRef: r.externalRef, name: r.name, governingLaw: r.governingLaw });
  }

  async findById(id: string): Promise<Deal | null> {
    const r = await this.prisma.deal.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }
  async findByExternalRef(ref: string): Promise<Deal | null> {
    const r = await this.prisma.deal.findUnique({ where: { externalRef: ref } });
    return r ? this.toDomain(r) : null;
  }
  async save(deal: Deal): Promise<void> {
    await this.prisma.deal.upsert({
      where: { id: deal.id.toString() },
      create: { id: deal.id.toString(), externalRef: deal.externalRef, name: deal.name, governingLaw: deal.governingLaw },
      update: { name: deal.name, governingLaw: deal.governingLaw },
    });
  }
  async list(): Promise<Deal[]> {
    const rs = await this.prisma.deal.findMany();
    return rs.map((r) => this.toDomain(r));
  }
}
