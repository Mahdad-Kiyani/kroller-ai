-- Adds the AI-produced verbatim quote text backing each scrape flag.
-- Every statement is idempotent (ADD COLUMN IF NOT EXISTS) so it is a no-op
-- against an already-migrated database yet valid for a fresh one.

-- AlterTable: verbatim quote text for the AI-detected knowledge / materiality qualifiers
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiKnowledgeScrapeText"   TEXT;
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "aiMaterialityScrapeText" TEXT;
