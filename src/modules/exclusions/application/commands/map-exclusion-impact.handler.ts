import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { MapExclusionImpactCommand } from './map-exclusion-impact.command';
import { ExclusionRepository, EXCLUSION_REPOSITORY } from '../../domain/exclusion.repository';
import { ExclusionMapperPort, EXCLUSION_MAPPER } from '../ports/exclusion-mapper.port';

/**
 * Runs the AI exclusion-impact mapping for one exclusion against all deal warranties,
 * replaces the stored impacts, and audits the AI output (a human can later confirm/edit).
 */
@CommandHandler(MapExclusionImpactCommand)
export class MapExclusionImpactHandler implements ICommandHandler<MapExclusionImpactCommand> {
  private readonly logger = new Logger(MapExclusionImpactHandler.name);

  constructor(
    @Inject(EXCLUSION_REPOSITORY) private readonly repo: ExclusionRepository,
    @Inject(EXCLUSION_MAPPER) private readonly mapper: ExclusionMapperPort,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: MapExclusionImpactCommand): Promise<{ mapped: number }> {
    this.logger.log(`Mapping exclusion impact: exclusionId=${cmd.exclusionId} actor=${cmd.actorId}`);
    const exclusion = await this.repo.findById(cmd.exclusionId);
    if (!exclusion) throw new NotFoundException('Exclusion not found.');

    const warranties = await this.prisma.warranty.findMany({ where: { dealId: exclusion.dealId } });
    this.logger.log(`Found ${warranties.length} warranties for deal ${exclusion.dealId} — running AI mapping`);

    const mapped = await this.mapper.map({
      exclusionText: exclusion.text,
      warranties: warranties.map((w) => ({ id: w.id, spaReference: w.spaReference, title: w.title, fullText: w.fullText })),
    });

    const impacts = mapped.map((m) => ({
      exclusionId: cmd.exclusionId,
      warrantyId: m.warrantyId,
      rationale: m.rationale,
      confidence: m.confidence,
    }));
    await this.repo.replaceImpacts(cmd.exclusionId, impacts);
    this.logger.log(`Impacts saved: ${impacts.length} warranties affected by exclusion ${cmd.exclusionId}`);

    await this.audit.record({
      actorId: cmd.actorId,
      action: 'EXCLUSION_IMPACT_MAPPED',
      entityType: 'Exclusion',
      entityId: cmd.exclusionId,
      before: null,
      after: { source: 'AI', impacts: impacts.map((i) => ({ warrantyId: i.warrantyId, confidence: i.confidence })) },
    });
    return { mapped: impacts.length };
  }
}
