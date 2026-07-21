import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ExclusionRepository, ExclusionWithImpacts } from '../domain/exclusion.repository';
import { Exclusion } from '../domain/exclusion.aggregate';
import { ExclusionImpact, coerceImpactType } from '../domain/exclusion-impact';

@Injectable()
export class PrismaExclusionRepository implements ExclusionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Exclusion | null> {
    const r = await this.prisma.exclusion.findUnique({ where: { id } });
    return r ? Exclusion.reconstitute(r.id, { dealId: r.dealId, label: r.label, text: r.text, isStandard: r.isStandard }) : null;
  }

  async save(e: Exclusion): Promise<void> {
    await this.prisma.exclusion.upsert({
      where: { id: e.id.toString() },
      create: { id: e.id.toString(), dealId: e.dealId, label: e.label, text: e.text, isStandard: e.isStandard },
      update: { label: e.label, text: e.text, isStandard: e.isStandard },
    });
  }

  /** Idempotent re-mapping: clear prior AI impacts for this exclusion, then insert fresh. */
  async replaceImpacts(exclusionId: string, impacts: ExclusionImpact[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.exclusionImpact.deleteMany({ where: { exclusionId } }),
      this.prisma.exclusionImpact.createMany({
        data: impacts.map((i) => ({
          exclusionId: i.exclusionId, warrantyId: i.warrantyId, type: i.type, rationale: i.rationale, confidence: i.confidence,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async listByDeal(dealId: string): Promise<ExclusionWithImpacts[]> {
    const rows = await this.prisma.exclusion.findMany({
      where: { dealId },
      include: { impacts: { include: { warranty: { select: { spaReference: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((e) => {
      const impacts = e.impacts.map((i) => ({
        warrantyId: i.warrantyId,
        spaReference: i.warranty.spaReference,
        type: coerceImpactType(i.type),
        rationale: i.rationale,
        confidence: i.confidence,
      }));
      // "Mapped" is equivalent to "has impacts" — impacts are only ever written by a
      // successful map. Derive the mapped-at timestamp from the earliest impact so the
      // frontend's badge guard (mappedAt && impacts.length > 0) resolves correctly.
      const mappedAt =
        e.impacts.length > 0
          ? e.impacts.reduce((min, i) => (i.createdAt < min ? i.createdAt : min), e.impacts[0].createdAt).toISOString()
          : null;
      return {
        id: e.id,
        label: e.label,
        text: e.text,
        isStandard: e.isStandard,
        affectedCount: impacts.length,
        warrantyIds: impacts.map((i) => i.warrantyId),
        mappedAt,
        impacts,
      };
    });
  }
}
