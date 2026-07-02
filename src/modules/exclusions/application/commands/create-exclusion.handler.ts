import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateExclusionCommand } from './create-exclusion.command';
import { Exclusion } from '../../domain/exclusion.aggregate';
import { ExclusionRepository, EXCLUSION_REPOSITORY } from '../../domain/exclusion.repository';

@CommandHandler(CreateExclusionCommand)
export class CreateExclusionHandler implements ICommandHandler<CreateExclusionCommand> {
  private readonly logger = new Logger(CreateExclusionHandler.name);

  constructor(
    @Inject(EXCLUSION_REPOSITORY) private readonly repo: ExclusionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CreateExclusionCommand): Promise<{ id: string }> {
    this.logger.log(`Creating exclusion: dealId=${cmd.dealId} label="${cmd.label}" isStandard=${cmd.isStandard}`);
    const deal = await this.prisma.deal.findUnique({ where: { id: cmd.dealId } });
    if (!deal) throw new NotFoundException('Deal not found.');

    const created = Exclusion.create({ dealId: cmd.dealId, label: cmd.label, text: cmd.text, isStandard: cmd.isStandard });
    if (created.isFailure) throw new BadRequestException(created.error);

    const exclusion = created.getValue();
    await this.repo.save(exclusion);
    this.logger.log(`Exclusion created: id=${exclusion.id.toString()}`);
    return { id: exclusion.id.toString() };
  }
}
