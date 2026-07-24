-- Forward-only healing migration.
--
-- Why this exists: migrations 20260721072918 / 20260721072919 / 20260721100000 had
-- their history rows recorded in _prisma_migrations as "applied" on some databases,
-- but their SQL never actually ran there (the original files were lost and later
-- reconstructed). `prisma migrate deploy` skips anything already recorded, so those
-- ALTER TABLEs never executed and the Warranty scrape/ordering columns stayed missing
-- (Postgres 42703 / Prisma P2022: `column Warranty.aiKnowledgeScrape does not exist`).
--
-- This migration has a NEW timestamp that is NOT yet in any DB's history, so
-- `migrate deploy` runs it exactly once everywhere. Every statement is idempotent
-- (IF NOT EXISTS / guarded DO block), so it heals a drifted DB and is a harmless
-- no-op on a healthy one. Do not edit after applying — add a new migration instead.

-- Enum backing the scrape-status columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScrapeStatus') THEN
    CREATE TYPE "ScrapeStatus" AS ENUM ('NO', 'PARTIAL', 'YES');
  END IF;
END
$$;

-- Scrape flags (AI-produced + effective) and override provenance
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiKnowledgeScrape"       "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiMaterialityScrape"     "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "knowledgeScrape"         "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "materialityScrape"       "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiKnowledgeScrapeText"   TEXT;
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiMaterialityScrapeText" TEXT;
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "scrapesOverriddenAt"     TIMESTAMP(3);
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "scrapesOverriddenBy"     TEXT;

-- Stable ordering columns
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "sortKey" TEXT;
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "ordinal" INTEGER;

-- Ordering / scrape-status filtering indexes
CREATE INDEX IF NOT EXISTS "Warranty_dealId_sortKey_ordinal_idx"   ON "Warranty"("dealId", "sortKey", "ordinal");
CREATE INDEX IF NOT EXISTS "Warranty_dealId_knowledgeScrape_idx"   ON "Warranty"("dealId", "knowledgeScrape");
CREATE INDEX IF NOT EXISTS "Warranty_dealId_materialityScrape_idx" ON "Warranty"("dealId", "materialityScrape");
