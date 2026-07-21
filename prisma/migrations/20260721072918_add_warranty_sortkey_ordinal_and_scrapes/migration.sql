-- Reconstructed migration (history was recorded as applied but the SQL file was lost).
-- Rebuilt from the live DB schema; every statement is idempotent (IF NOT EXISTS / guarded
-- DO block) so it is a no-op against the already-migrated database yet valid for a fresh one.

-- CreateEnum: ScrapeStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScrapeStatus') THEN
    CREATE TYPE "ScrapeStatus" AS ENUM ('NO', 'PARTIAL', 'YES');
  END IF;
END
$$;

-- AlterTable: scrape flags (AI-produced + effective) and override provenance
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiKnowledgeScrape"   "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiMaterialityScrape" "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "knowledgeScrape"     "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "materialityScrape"   "ScrapeStatus" NOT NULL DEFAULT 'NO';
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "scrapesOverriddenAt" TIMESTAMP(3);
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "scrapesOverriddenBy" TEXT;

-- AlterTable: stable ordering columns
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "sortKey" TEXT;
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "ordinal" INTEGER;
