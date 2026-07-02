import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { OverrideCategoryCommand } from './override-category.command';
import { WarrantyRepository, WARRANTY_REPOSITORY } from '../../domain/warranty.repository';

/** Human category override → writes the AI-vs-human audit entry. */
@CommandHandler(OverrideCategoryCommand)
export class OverrideCategoryHandler implements ICommandHandler<OverrideCategoryCommand> {
  private readonly logger = new Logger(OverrideCategoryHandler.name);

  constructor(
    @Inject(WARRANTY_REPOSITORY) private readonly repo: WarrantyRepository,
    private readonly publisher: EventPublisher,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: OverrideCategoryCommand): Promise<{ category: string }> {
    this.logger.log(`Category override: warrantyId=${cmd.warrantyId} category=${cmd.category} actor=${cmd.actorId}`);
    const loaded = await this.repo.findById(cmd.warrantyId);
    if (!loaded) throw new NotFoundException('Warranty not found.');

    const aiSuggestion = loaded.aiCategory;
    const w = this.publisher.mergeObjectContext(loaded);
    const result = w.overrideCategory(cmd.category, cmd.actorId);
    if (result.isFailure) throw new BadRequestException(result.error);

    await this.repo.save(w);
    await this.audit.record({
      actorId: cmd.actorId,
      action: 'WARRANTY_CATEGORY_OVERRIDDEN',
      entityType: 'Warranty',
      entityId: cmd.warrantyId,
      before: { category: aiSuggestion, source: 'AI' },
      after: { category: cmd.category, source: 'HUMAN' },
    });
    w.commit();
    this.logger.log(`Category overridden: warrantyId=${cmd.warrantyId} AI=${aiSuggestion ?? 'none'} → HUMAN=${cmd.category}`);
    return { category: cmd.category };
  }
}
