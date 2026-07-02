import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { EmbeddingPort, EMBEDDING_PORT } from '@shared/infrastructure/embeddings/embedding.port';
import { VectorStore } from '@shared/infrastructure/embeddings/vector-store.service';

/**
 * BullMQ consumer for warranty-embed: embed the warranty text → store the pgvector.
 * concurrency: 5 lets embed jobs run in parallel instead of one-at-a-time, so a document
 * with many warranties doesn't serialise through the embeddings API on ingest. Fixed here
 * rather than read from AppConfig: @Processor's options are evaluated at class-decoration
 * (import) time, before ConfigModule has loaded env vars.
 */
@Processor('warranty-embed', { concurrency: 5 })
export class WarrantyEmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(WarrantyEmbedProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PORT) private readonly embedder: EmbeddingPort,
    private readonly vectors: VectorStore,
  ) {
    super();
  }
  async process(job: Job<{ warrantyId: string }>): Promise<void> {
    this.logger.log(`Embed job started: warrantyId=${job.data.warrantyId}`);
    const w = await this.prisma.warranty.findUnique({ where: { id: job.data.warrantyId } });
    if (!w) {
      this.logger.warn(`Warranty not found for embed: ${job.data.warrantyId} — skipping`);
      return;
    }
    this.logger.debug(`Embedding warranty title="${w.title}"`);
    const [embedding] = await this.embedder.embed([`${w.title}\n${w.fullText}`]);
    await this.vectors.saveEmbedding(w.id, embedding);
    this.logger.log(`Embed job complete: warrantyId=${w.id} dim=${embedding.length}`);
  }
}
