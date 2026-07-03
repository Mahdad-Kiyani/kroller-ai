import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StoragePort, STORAGE_PORT } from '@shared/infrastructure/storage/storage.port';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { DeleteDealCommand } from './delete-deal.command';

const ACTOR = 'service'; // replace with authenticated principal once portal identity is wired

export interface DeleteDealResult {
  deleted: boolean;
  documentsRemoved: number;
  warrantiesRemoved: number;
  exclusionsRemoved: number;
}

/**
 * Permanently removes a deal and everything under it: every document's MinIO object, then
 * the deal row itself (cascades documents, warranties, exclusions, and exclusion impacts at
 * the DB level). The deal's prior AuditLog entries are intentionally left in place — the
 * audit trail is retained independently of the entities it describes (7-year retention).
 */
@CommandHandler(DeleteDealCommand)
export class DeleteDealHandler implements ICommandHandler<DeleteDealCommand> {
  private readonly logger = new Logger(DeleteDealHandler.name);

  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: DeleteDealCommand): Promise<DeleteDealResult> {
    const deal = await this.prisma.deal.findUnique({ where: { id: cmd.dealId } });
    if (!deal) throw new NotFoundException('Deal not found.');

    const [documents, warrantiesRemoved, exclusionsRemoved] = await Promise.all([
      this.prisma.document.findMany({ where: { dealId: deal.id }, select: { storageKey: true } }),
      this.prisma.warranty.count({ where: { dealId: deal.id } }),
      this.prisma.exclusion.count({ where: { dealId: deal.id } }),
    ]);

    await Promise.allSettled(documents.map((doc) => this.storage.deleteObject(doc.storageKey)));

    await this.prisma.deal.delete({ where: { id: deal.id } });

    await this.audit.record({
      actorId: ACTOR,
      action: 'DEAL_DELETED',
      entityType: 'Deal',
      entityId: deal.id,
      before: {
        name: deal.name,
        externalRef: deal.externalRef,
        documentsRemoved: documents.length,
        warrantiesRemoved,
        exclusionsRemoved,
      },
      after: null,
    });

    this.logger.log(
      `Deal ${deal.id} deleted: documents=${documents.length} warranties=${warrantiesRemoved} exclusions=${exclusionsRemoved}`,
    );
    return { deleted: true, documentsRemoved: documents.length, warrantiesRemoved, exclusionsRemoved };
  }
}
