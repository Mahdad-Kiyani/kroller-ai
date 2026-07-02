import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { IngestParsedWarrantiesCommand } from '../application/commands/ingest-parsed-warranties.command';

/** BullMQ consumer for the warranty-parse queue. Thin: dispatches the ingest command. */
@Processor('warranty-parse')
export class WarrantyParseProcessor extends WorkerHost {
  private readonly logger = new Logger(WarrantyParseProcessor.name);
  constructor(private readonly commandBus: CommandBus) {
    super();
  }
  async process(job: Job<{ documentId: string }>): Promise<void> {
    this.logger.log(`Parse job started: documentId=${job.data.documentId} attempt=${job.attemptsMade + 1}`);
    try {
      const result = await this.commandBus.execute<IngestParsedWarrantiesCommand, { ingested: number; flagged: number }>(
        new IngestParsedWarrantiesCommand(job.data.documentId),
      );
      this.logger.log(`Parse job complete: documentId=${job.data.documentId} ingested=${result.ingested} flagged=${result.flagged}`);
    } catch (err) {
      this.logger.error(`Parse job failed: documentId=${job.data.documentId} error=${(err as Error).message}`);
      throw err;
    }
  }
}
