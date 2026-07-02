import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SimilarWarranty {
  id: string;
  dealId: string;
  spaReference: string;
  decidedPosition: string | null;
  decidedComment: string | null;
  category: string | null;
  distance: number; // cosine distance (0 = identical)
}

/**
 * Encapsulates the pgvector raw SQL. Stores a warranty embedding and finds the nearest
 * past warranties that already carry a HUMAN decision — the basis for suggestions.
 */
@Injectable()
export class VectorStore {
  private readonly logger = new Logger(VectorStore.name);

  constructor(private readonly prisma: PrismaService) {}

  private toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }

  private parseVectorLiteral(literal: string): number[] {
    return literal.slice(1, -1).split(',').map(Number);
  }

  /**
   * Batch-reads already-stored embeddings so callers (suggestion generation, similarity
   * lookup) can skip re-calling the embeddings API for warranties embedded by the
   * warranty-embed queue. Missing/never-embedded ids are simply absent from the map.
   */
  async getEmbeddings(warrantyIds: string[]): Promise<Map<string, number[]>> {
    if (warrantyIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRawUnsafe<{ id: string; embedding: string }[]>(
      `SELECT id, embedding::text AS embedding
         FROM "Warranty"
        WHERE id = ANY($1::text[]) AND embedding IS NOT NULL`,
      warrantyIds,
    );
    return new Map(rows.map((r) => [r.id, this.parseVectorLiteral(r.embedding)]));
  }

  async saveEmbedding(warrantyId: string, embedding: number[]): Promise<void> {
    const literal = this.toVectorLiteral(embedding);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Warranty" SET embedding = $1::vector WHERE id = $2`,
      literal,
      warrantyId,
    );
    this.logger.debug(`Embedding saved: warrantyId=${warrantyId} dim=${embedding.length}`);
  }

  /**
   * Nearest neighbours (cosine) among warranties from OTHER deals that have a decided
   * position, optionally restricted to the same category (fundamental↔fundamental).
   */
  async findDecidedNeighbours(params: {
    embedding: number[];
    excludeDealId: string;
    category: string | null;
    limit: number;
  }): Promise<SimilarWarranty[]> {
    this.logger.debug(`Vector search: excludeDeal=${params.excludeDealId} category=${params.category} limit=${params.limit}`);
    const literal = this.toVectorLiteral(params.embedding);
    const rows = await this.prisma.$queryRawUnsafe<SimilarWarranty[]>(
      `SELECT id, "dealId", "spaReference", "decidedPosition"::text AS "decidedPosition",
              "decidedComment", "category"::text AS category,
              (embedding <=> $1::vector) AS distance
         FROM "Warranty"
        WHERE embedding IS NOT NULL
          AND "decidedPosition" IS NOT NULL
          AND "dealId" <> $2
          AND ($3::text IS NULL OR "category"::text = $3)
        ORDER BY embedding <=> $1::vector
        LIMIT $4`,
      literal,
      params.excludeDealId,
      params.category,
      params.limit,
    );
    this.logger.debug(`Vector search found ${rows.length} decided neighbours (category=${params.category})`);
    return rows;
  }
}
