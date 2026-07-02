import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { WarrantyRepository } from '../domain/warranty.repository';
import { Warranty } from '../domain/warranty.aggregate';
import { WarrantyMapper } from './warranty.mapper';

@Injectable()
export class PrismaWarrantyRepository implements WarrantyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Warranty | null> {
    const r = await this.prisma.warranty.findUnique({ where: { id } });
    return r ? WarrantyMapper.toDomain(r) : null;
  }

  async save(w: Warranty): Promise<void> {
    await this.prisma.warranty.upsert({
      where: { id: w.id.toString() },
      create: WarrantyMapper.toCreate(w),
      update: WarrantyMapper.toUpdate(w),
    });
  }

  async saveMany(ws: Warranty[]): Promise<void> {
    if (ws.length === 0) return;
    await this.prisma.warranty.createMany({ data: ws.map(WarrantyMapper.toCreate), skipDuplicates: true });
  }

  async listByDeal(dealId: string): Promise<Warranty[]> {
    const rows = await this.prisma.warranty.findMany({ where: { dealId } });
    return rows.map(WarrantyMapper.toDomain);
  }
}
