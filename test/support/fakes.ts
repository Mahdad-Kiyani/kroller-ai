import { WarrantyParserPort, ParsedWarrantyRow } from '@modules/warranties/application/ports/warranty-parser.port';
import { ExclusionMapperPort, MappableWarranty, MappedImpact } from '@modules/exclusions/application/ports/exclusion-mapper.port';
import { EmbeddingPort } from '@shared/infrastructure/embeddings/embedding.port';
import { StoragePort } from '@shared/infrastructure/storage/storage.port';
import { AuditEntry } from '@shared/infrastructure/audit/audit-logger.service';
import { SimilarWarranty } from '@shared/infrastructure/embeddings/vector-store.service';

/** Returns whatever rows it is seeded with — no network. */
export class FakeWarrantyParser implements WarrantyParserPort {
  constructor(private readonly rows: ParsedWarrantyRow[]) {}
  async parse(): Promise<ParsedWarrantyRow[]> {
    return this.rows;
  }
}

export class FakeExclusionMapper implements ExclusionMapperPort {
  constructor(private readonly impacts: MappedImpact[]) {}
  async map(_input: { exclusionText: string; warranties: MappableWarranty[] }): Promise<MappedImpact[]> {
    return this.impacts;
  }
}

/** Deterministic pseudo-embeddings so similarity is reproducible in tests. */
export class FakeEmbeddingPort implements EmbeddingPort {
  readonly dimension = 1536;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      let seed = 0;
      for (let i = 0; i < t.length; i++) seed = (seed * 31 + t.charCodeAt(i)) % 1_000_000;
      return Array.from({ length: this.dimension }, (_, i) => ((seed + i) % 100) / 100);
    });
  }
}

export class FakeStoragePort implements StoragePort {
  store = new Map<string, Buffer>();
  async putObject(key: string, body: Buffer): Promise<void> {
    this.store.set(key, body);
  }
  async getObject(key: string): Promise<Buffer> {
    return this.store.get(key) ?? Buffer.from('');
  }
  async presignGetUrl(key: string): Promise<string> {
    return `https://fake-storage.local/${key}`;
  }
}

/** Captures audit entries in memory so tests can assert the AI-vs-human trail. */
export class FakeAuditLogger {
  entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Seeded neighbour search; ignores the query vector. */
export class FakeVectorStore {
  saved = new Map<string, number[]>();
  constructor(private readonly neighbours: SimilarWarranty[] = []) {}
  async saveEmbedding(warrantyId: string, embedding: number[]): Promise<void> {
    this.saved.set(warrantyId, embedding);
  }
  /** No persisted-embedding cache in tests — callers always fall back to FakeEmbeddingPort. */
  async getEmbeddings(_warrantyIds: string[]): Promise<Map<string, number[]>> {
    return new Map();
  }
  async findDecidedNeighbours(params: { category: string | null }): Promise<SimilarWarranty[]> {
    if (params.category === null) return this.neighbours;
    return this.neighbours.filter((n) => n.category === params.category);
  }
}

/** No-op CQRS publisher: returns the aggregate unchanged so commit() is a safe no-op. */
export const fakeEventPublisher = { mergeObjectContext: <T>(o: T): T => o } as unknown as import('@nestjs/cqrs').EventPublisher;
