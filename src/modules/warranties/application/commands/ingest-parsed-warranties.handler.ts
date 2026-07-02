import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { IngestParsedWarrantiesCommand } from './ingest-parsed-warranties.command';
import { Warranty } from '../../domain/warranty.aggregate';
import { Category } from '../../domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '../../domain/value-objects/confidence-score.vo';
import { WarrantyRepository, WARRANTY_REPOSITORY } from '../../domain/warranty.repository';
import { WarrantyParserPort, WARRANTY_PARSER } from '../ports/warranty-parser.port';

/**
 * Runs in the warranty-parse worker. Fetches the document, runs the AI parser, builds
 * Warranty aggregates (validating into the 4-bucket VO), persists them, and updates the
 * Document status. Committing the aggregates publishes WarrantyCategorised → embeddings.
 */
@CommandHandler(IngestParsedWarrantiesCommand)
export class IngestParsedWarrantiesHandler implements ICommandHandler<IngestParsedWarrantiesCommand> {
  private readonly logger = new Logger(IngestParsedWarrantiesHandler.name);

  constructor(
    @Inject(WARRANTY_REPOSITORY) private readonly repo: WarrantyRepository,
    @Inject(WARRANTY_PARSER) private readonly parser: WarrantyParserPort,
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: IngestParsedWarrantiesCommand): Promise<{ ingested: number; flagged: number }> {
    const doc = await this.prisma.document.findUnique({ where: { id: cmd.documentId } });
    if (!doc) throw new NotFoundException('Document not found.');

    this.logger.log(`Starting parse: documentId=${cmd.documentId} storageKey=${doc.storageKey} mime=${doc.mimeType}`);
    await this.prisma.document.update({ where: { id: doc.id }, data: { status: 'PARSING' } });

    try {
      this.logger.log(`Calling warranty parser (document status → PARSING)...`);
      const rows = await this.parser.parse({ storageKey: doc.storageKey, mimeType: doc.mimeType });
      this.logger.log(`Parser returned ${rows.length} rows — building domain aggregates`);
      const warranties: Warranty[] = [];
      let flagged = 0;

      for (const row of rows) {
        const category = Category.fromString(row.category);
        const confidence = ConfidenceScore.create(row.confidence);
        if (category.isFailure || confidence.isFailure) {
          this.logger.warn(`Skipping row ${row.spaReference}: ${category.error ?? confidence.error}`);
          continue;
        }
        const created = Warranty.fromParsedRow({
          dealId: doc.dealId,
          spaReference: row.spaReference,
          title: row.title,
          fullText: row.fullText,
          aiCategory: category.getValue(),
          aiConfidence: confidence.getValue(),
          pageRef: row.pageRef,
        });
        if (created.isFailure) continue;
        const w = this.publisher.mergeObjectContext(created.getValue());
        if (w.needsReview()) flagged += 1;
        warranties.push(w);
      }

      await this.repo.saveMany(warranties);
      warranties.forEach((w) => w.commit());
      await this.prisma.document.update({ where: { id: doc.id }, data: { status: 'PARSED' } });

      this.logger.log(`Document ${doc.id}: ingested ${warranties.length}, flagged ${flagged}`);
      return { ingested: warranties.length, flagged };
    } catch (err) {
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'FAILED', error: (err as Error).message },
      });
      throw err;
    }
  }
}
