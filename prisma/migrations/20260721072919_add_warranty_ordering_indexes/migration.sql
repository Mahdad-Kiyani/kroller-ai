-- Reconstructed migration (history was recorded as applied but the SQL file was lost).
-- Rebuilt from the live DB schema; every statement is idempotent (IF NOT EXISTS) so it is a
-- no-op against the already-migrated database yet valid for a fresh one.

-- CreateIndex: stable ordering
CREATE INDEX IF NOT EXISTS "Warranty_dealId_sortKey_ordinal_idx" ON "Warranty"("dealId", "sortKey", "ordinal");

-- CreateIndex: scrape-status filtering
CREATE INDEX IF NOT EXISTS "Warranty_dealId_knowledgeScrape_idx"   ON "Warranty"("dealId", "knowledgeScrape");
CREATE INDEX IF NOT EXISTS "Warranty_dealId_materialityScrape_idx" ON "Warranty"("dealId", "materialityScrape");
