import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { DecidePositionCommand } from './decide-position.command';
import { WarrantyRepository, WARRANTY_REPOSITORY } from '../../domain/warranty.repository';

/**
 * Human decides the coverage position. Records AI-vs-human audit and ensures the warranty
 * is embedded so it becomes precedent for future suggestions (closing the learning loop).
 */
@CommandHandler(DecidePositionCommand)
export class DecidePositionHandler implements ICommandHandler<DecidePositionCommand> {
  private readonly logger = new Logger(DecidePositionHandler.name);

  constructor(
    @Inject(WARRANTY_REPOSITORY) private readonly repo: WarrantyRepository,
    private readonly publisher: EventPublisher,
    private readonly audit: AuditLogger,
    @InjectQueue('warranty-embed') private readonly embedQueue: Queue,
  ) {}

  async execute(cmd: DecidePositionCommand): Promise<{ position: string }> {
    this.logger.log(`Position decision: warrantyId=${cmd.warrantyId} position=${cmd.position} actor=${cmd.actorId}`);
    const loaded = await this.repo.findById(cmd.warrantyId);
    if (!loaded) throw new NotFoundException('Warranty not found.');

    const aiPosition = loaded.aiPosition;
    const w = this.publisher.mergeObjectContext(loaded);
    w.decidePosition(cmd.position, cmd.comment, cmd.actorId);

    await this.repo.save(w);
    await this.audit.record({
      actorId: cmd.actorId,
      action: 'WARRANTY_POSITION_DECIDED',
      entityType: 'Warranty',
      entityId: cmd.warrantyId,
      before: { position: aiPosition, source: 'AI' },
      after: { position: cmd.position, source: 'HUMAN' },
    });
    w.commit();
    await this.embedQueue.add('embed', { warrantyId: cmd.warrantyId });
    this.logger.log(`Position decided: warrantyId=${cmd.warrantyId} AI=${aiPosition ?? 'none'} → HUMAN=${cmd.position} (embed job queued)`);
    return { position: cmd.position };
  }
}
