/*
  Warnings:

  - You are about to drop the column `aiKnowledgeScrape` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `aiMaterialityScrape` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `knowledgeScrape` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `materialityScrape` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `ordinal` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `scrapesOverriddenAt` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `scrapesOverriddenBy` on the `Warranty` table. All the data in the column will be lost.
  - You are about to drop the column `sortKey` on the `Warranty` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('FULL', 'PARTIAL', 'CARVE_OUT');

-- DropIndex
DROP INDEX "Warranty_dealId_knowledgeScrape_idx";

-- DropIndex
DROP INDEX "Warranty_dealId_materialityScrape_idx";

-- DropIndex
DROP INDEX "Warranty_dealId_sortKey_ordinal_idx";

-- DropIndex
DROP INDEX "warranty_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "ExclusionImpact" ADD COLUMN     "type" "ImpactType" NOT NULL DEFAULT 'PARTIAL';

-- AlterTable
ALTER TABLE "Warranty" DROP COLUMN "aiKnowledgeScrape",
DROP COLUMN "aiMaterialityScrape",
DROP COLUMN "knowledgeScrape",
DROP COLUMN "materialityScrape",
DROP COLUMN "ordinal",
DROP COLUMN "scrapesOverriddenAt",
DROP COLUMN "scrapesOverriddenBy",
DROP COLUMN "sortKey";

-- DropEnum
DROP TYPE "ScrapeStatus";
