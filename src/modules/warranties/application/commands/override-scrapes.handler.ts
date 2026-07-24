import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { OverrideScrapesCommand } from './override-scrapes.command';
import { WarrantyRepository, WARRANTY_REPOSITORY } from '../../domain/warranty.repository';

/** Human scrape override → writes the AI-vs-human audit entry. AI detection is preserved. */
@CommandHandler(OverrideScrapesCommand)
export class OverrideScrapesHandler implements ICommandHandler<OverrideScrapesCommand> {
  private readonly logger = new Logger(OverrideScrapesHandler.name);

  constructor(
    @Inject(WARRANTY_REPOSITORY) private readonly repo: WarrantyRepository,
    private readonly publisher: EventPublisher,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: OverrideScrapesCommand): Promise<{ knowledgeScrape: string; materialityScrape: string }> {
    this.logger.log(
      `Scrapes override: warrantyId=${cmd.warrantyId} ` +
        `knowledge=${cmd.knowledgeScrape} materiality=${cmd.materialityScrape} actor=${cmd.actorId}`,
    );
    const loaded = await this.repo.findById(cmd.warrantyId);
    if (!loaded) throw new NotFoundException('Warranty not found.');

    const aiKnowledge = loaded.aiKnowledgeScrape;
    const aiMateriality = loaded.aiMaterialityScrape;
    const w = this.publisher.mergeObjectContext(loaded);
    const result = w.overrideScrapes(
      { knowledgeScrape: cmd.knowledgeScrape, materialityScrape: cmd.materialityScrape },
      cmd.actorId,
    );
    if (result.isFailure) throw new BadRequestException(result.error);

    await this.repo.save(w);
    await this.audit.record({
      actorId: cmd.actorId,
      action: 'WARRANTY_SCRAPES_OVERRIDDEN',
      entityType: 'Warranty',
      entityId: cmd.warrantyId,
      before: { knowledgeScrape: aiKnowledge, materialityScrape: aiMateriality, source: 'AI' },
      after: { knowledgeScrape: cmd.knowledgeScrape, materialityScrape: cmd.materialityScrape, source: 'HUMAN' },
    });
    w.commit();
    this.logger.log(
      `Scrapes overridden: warrantyId=${cmd.warrantyId} ` +
        `AI(K=${aiKnowledge},M=${aiMateriality}) → HUMAN(K=${cmd.knowledgeScrape},M=${cmd.materialityScrape})`,
    );
    return { knowledgeScrape: cmd.knowledgeScrape, materialityScrape: cmd.materialityScrape };
  }
}
