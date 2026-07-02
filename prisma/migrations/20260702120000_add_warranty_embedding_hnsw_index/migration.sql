-- Warranty.embedding is Unsupported("vector(1536)") so Prisma cannot manage this index
-- via schema.prisma — it must be hand-written, same as the column itself.
--
-- VectorStore.findDecidedNeighbours orders by "embedding <=> $1::vector" (cosine distance).
-- With no index, Postgres sequential-scans and sorts every embedded warranty on every
-- suggestion/similarity request; this HNSW index makes that an approximate-NN index scan.
-- vector_cosine_ops is required to match the <=> operator used in the query.
--
-- CONCURRENTLY avoids locking writes to "Warranty" while the index builds; Prisma detects
-- CREATE INDEX CONCURRENTLY and automatically runs this migration outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "warranty_embedding_hnsw_idx"
  ON "Warranty" USING hnsw (embedding vector_cosine_ops);
