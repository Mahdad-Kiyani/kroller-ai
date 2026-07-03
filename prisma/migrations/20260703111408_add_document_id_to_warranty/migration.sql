-- Note: Prisma's migration diff proposed dropping "warranty_embedding_hnsw_idx" here because
-- that hand-written index on the Unsupported vector column isn't representable in
-- schema.prisma and so is invisible to the diff engine (see
-- 20260702120000_add_warranty_embedding_hnsw_index). Deliberately NOT dropping it — this
-- migration only adds the Warranty.documentId link.

-- AlterTable
ALTER TABLE "Warranty" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE INDEX "Warranty_documentId_idx" ON "Warranty"("documentId");

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
