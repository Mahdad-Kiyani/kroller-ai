import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException, Inject, Logger } from '@nestjs/common';
import { CreateDealCommand } from './create-deal.command';
import { Deal } from '../../domain/deal.aggregate';
import { DealRepository, DEAL_REPOSITORY } from '../../domain/deal.repository';

@CommandHandler(CreateDealCommand)
export class CreateDealHandler implements ICommandHandler<CreateDealCommand> {
  private readonly logger = new Logger(CreateDealHandler.name);

  constructor(@Inject(DEAL_REPOSITORY) private readonly repo: DealRepository) {}

  async execute(cmd: CreateDealCommand): Promise<{ id: string }> {
    this.logger.log(`Creating deal: externalRef=${cmd.externalRef} name="${cmd.name}"`);
    const existing = await this.repo.findByExternalRef(cmd.externalRef);
    if (existing) throw new ConflictException('A deal with this externalRef already exists.');

    const created = Deal.create({ externalRef: cmd.externalRef, name: cmd.name, governingLaw: cmd.governingLaw });
    if (created.isFailure) throw new BadRequestException(created.error);

    const deal = created.getValue();
    await this.repo.save(deal);
    this.logger.log(`Deal created: id=${deal.id.toString()} externalRef=${cmd.externalRef}`);
    return { id: deal.id.toString() };
  }
}
