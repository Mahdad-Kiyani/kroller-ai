import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { EmbeddingPort, EMBEDDING_PORT } from '@shared/infrastructure/embeddings/embedding.port';
import { VectorStore } from '@shared/infrastructure/embeddings/vector-store.service';
import { GetSimilarWarrantiesQuery } from './get-similar.query';

export interface SimilarWarrantyDto {
  warrantyId: string;
  dealName: string;
  spaReference: string;
  title: string;
  category: string | null;
  decidedPosition: string | null;
  similarity: number;
}

const CACHE_TTL_MS = 3 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  data: SimilarWarrantyDto[];
}

@QueryHandler(GetSimilarWarrantiesQuery)
export class GetSimilarWarrantiesHandler implements IQueryHandler<GetSimilarWarrantiesQuery> {
  private readonly logger = new Logger(GetSimilarWarrantiesHandler.name);

  // Per-instance, in-memory result cache keyed by `warrantyId:limit`. The console's drawer
  // re-requests this endpoint on every parse-status poll (every 2s while a document is
  // parsing) even though precedent rarely changes that fast — a short TTL turns those into
  // free cache hits instead of repeat pgvector queries / embeddings-API calls.
  private readonly cache = new Map<string, CacheEntry>();
  // Collapses concurrent identical requests (e.g. two poll ticks racing) into one computation.
  private readonly inFlight = new Map<string, Promise<SimilarWarrantyDto[]>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PORT) private readonly embedder: EmbeddingPort,
    private readonly vectors: VectorStore,
  ) {}

  async execute(q: GetSimilarWarrantiesQuery): Promise<SimilarWarrantyDto[]> {
    const cacheKey = `${q.warrantyId}:${q.limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const promise = this.compute(q)
      .then((data) => {
        this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
        return data;
      })
      .finally(() => this.inFlight.delete(cacheKey));
    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  private async compute(q: GetSimilarWarrantiesQuery): Promise<SimilarWarrantyDto[]> {
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
      warrantyId: n.id, dealName: n.dealName, spaReference: n.spaReference, title: n.title,
      category: n.category, decidedPosition: n.decidedPosition,
      similarity: Math.max(0, Math.min(1, 1 / (1 + n.distance))),
    }));
  }
}
