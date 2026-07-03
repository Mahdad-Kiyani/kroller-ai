import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StoragePort, STORAGE_PORT } from '@shared/infrastructure/storage/storage.port';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';
import { DeleteDocumentCommand } from './delete-document.command';

const ACTOR = 'service'; // replace with authenticated principal once portal identity is wired

/**
 * Permanently removes an uploaded document: the MinIO object, the Document row, and every
 * warranty parsed from it (cascade via Warranty.documentId), plus their exclusion impacts.
 */
@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentHandler implements ICommandHandler<DeleteDocumentCommand> {
  private readonly logger = new Logger(DeleteDocumentHandler.name);

  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogger,
  ) {}

  async execute(cmd: DeleteDocumentCommand): Promise<{ deleted: boolean; warrantiesRemoved: number }> {
    const doc = await this.prisma.document.findUnique({ where: { id: cmd.documentId } });
    if (!doc) throw new NotFoundException('Document not found.');

    const warrantiesRemoved = await this.prisma.warranty.count({ where: { documentId: doc.id } });

    await this.storage.deleteObject(doc.storageKey);
    await this.prisma.document.delete({ where: { id: doc.id } });

    await this.audit.record({
      actorId: ACTOR,
      action: 'DOCUMENT_DELETED',
      entityType: 'Document',
      entityId: doc.id,
      before: { fileName: doc.filename, storageKey: doc.storageKey, warrantiesRemoved },
      after: null,
    });

    this.logger.log(`Document ${doc.id} deleted: storageKey=${doc.storageKey} warrantiesRemoved=${warrantiesRemoved}`);
    return { deleted: true, warrantiesRemoved };
  }
}
