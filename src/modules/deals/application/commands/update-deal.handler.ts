import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { UpdateDealCommand } from './update-deal.command';
import { DealRepository, DEAL_REPOSITORY } from '../../domain/deal.repository';

const ACTOR = 'service'; // replace with authenticated principal once portal identity is wired

@CommandHandler(UpdateDealCommand)
export class UpdateDealHandler implements ICommandHandler<UpdateDealCommand> {
  private readonly logger = new Logger(UpdateDealHandler.name);

  constructor(
    @Inject(DEAL_REPOSITORY) private readonly repo: DealRepository,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: UpdateDealCommand): Promise<{ id: string }> {
    const deal = await this.repo.findById(cmd.dealId);
    if (!deal) throw new NotFoundException('Deal not found.');

    const before = { name: deal.name, governingLaw: deal.governingLaw };
    const result = deal.updateDetails({ name: cmd.name, governingLaw: cmd.governingLaw });
    if (result.isFailure) throw new BadRequestException(result.error);

    await this.repo.save(deal);
    await this.audit.record({
      actorId: ACTOR,
      action: 'DEAL_UPDATED',
      entityType: 'Deal',
      entityId: deal.id.toString(),
      before,
      after: { name: deal.name, governingLaw: deal.governingLaw },
    });

    this.logger.log(`Deal updated: id=${deal.id.toString()}`);
    return { id: deal.id.toString() };
  }
}
