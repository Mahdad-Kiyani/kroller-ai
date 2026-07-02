import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { EmbeddingPort, EMBEDDING_PORT } from '@shared/infrastructure/embeddings/embedding.port';
import { VectorStore } from '@shared/infrastructure/embeddings/vector-store.service';
import { GetSimilarWarrantiesQuery } from './get-similar.query';

export interface SimilarWarrantyDto {
  id: string;
  dealId: string;
  spaReference: string;
  decidedPosition: string | null;
  similarity: number;
}

@QueryHandler(GetSimilarWarrantiesQuery)
export class GetSimilarWarrantiesHandler implements IQueryHandler<GetSimilarWarrantiesQuery> {
  private readonly logger = new Logger(GetSimilarWarrantiesHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PORT) private readonly embedder: EmbeddingPort,
    private readonly vectors: VectorStore,
  ) {}

  async execute(q: GetSimilarWarrantiesQuery): Promise<SimilarWarrantyDto[]> {
    const w = await this.prisma.warranty.findUnique({ where: { id: q.warrantyId } });
    if (!w) throw new NotFoundException('Warranty not found.');

    // Reuse the vector already persisted by the warranty-embed queue when present —
    // only call the embeddings API for a warranty that was never (yet) embedded.
    let embedding = (await this.vectors.getEmbeddings([w.id])).get(w.id);
    if (!embedding) {
      [embedding] = await this.embedder.embed([`${w.title}\n${w.fullText}`]);
      await this.vectors.saveEmbedding(w.id, embedding).catch((err: unknown) => {
        this.logger.error(`Failed to persist embedding for warranty ${w.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    const neighbours = await this.vectors.findDecidedNeighbours({
      embedding, excludeDealId: w.dealId, category: w.category, limit: q.limit,
    });
    return neighbours.map((n) => ({
      id: n.id, dealId: n.dealId, spaReference: n.spaReference,
      decidedPosition: n.decidedPosition, similarity: Math.max(0, Math.min(1, 1 / (1 + n.distance))),
    }));
  }
}
