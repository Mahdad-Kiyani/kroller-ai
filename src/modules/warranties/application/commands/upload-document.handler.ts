import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StoragePort, STORAGE_PORT } from '@shared/infrastructure/storage/storage.port';
import { UploadDocumentCommand } from './upload-document.command';

/** Stores the upload in MinIO, records a Document, and enqueues async parsing. */
@CommandHandler(UploadDocumentCommand)
export class UploadDocumentHandler implements ICommandHandler<UploadDocumentCommand> {
  private readonly logger = new Logger(UploadDocumentHandler.name);

  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly prisma: PrismaService,
    @InjectQueue('warranty-parse') private readonly queue: Queue,
  ) {}

  async execute(cmd: UploadDocumentCommand): Promise<{ documentId: string; storageKey: string }> {
    this.logger.log(`Upload request: deal=${cmd.dealId} file="${cmd.filename}" mime=${cmd.mimeType} size=${cmd.buffer.length}B`);

    const deal = await this.prisma.deal.findUnique({ where: { id: cmd.dealId } });
    if (!deal) throw new NotFoundException('Deal not found.');
    this.logger.debug(`Deal found: "${deal.name}" (id=${cmd.dealId})`);

    const storageKey = `deals/${cmd.dealId}/${randomUUID()}-${cmd.filename}`;
    await this.storage.putObject(storageKey, cmd.buffer, cmd.mimeType);
    this.logger.log(`File stored → MinIO key: ${storageKey}`);

    const doc = await this.prisma.document.create({
      data: { dealId: cmd.dealId, storageKey, filename: cmd.filename, mimeType: cmd.mimeType, status: 'UPLOADED' },
    });
    this.logger.log(`Document record created: id=${doc.id} status=UPLOADED`);

    await this.queue.add('parse', { documentId: doc.id }, { attempts: 3, backoff: { type: 'exponential', delay: 4000 } });
    this.logger.log(`Parse job enqueued for document ${doc.id} (3 attempts, exponential backoff)`);

    return { documentId: doc.id, storageKey };
  }
}
