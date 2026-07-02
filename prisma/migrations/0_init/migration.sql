-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "WarrantyCategory" AS ENUM ('FUNDAMENTAL', 'BUSINESS', 'TAX', 'TAX_INDEMNITY');

-- CreateEnum
CREATE TYPE "CoveragePosition" AS ENUM ('COVERED', 'PARTIAL', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "governingLaw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "spaReference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "aiCategory" "WarrantyCategory",
    "aiConfidence" DOUBLE PRECISION,
    "pageRef" INTEGER,
    "category" "WarrantyCategory",
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "aiPosition" "CoveragePosition",
    "aiComment" TEXT,
    "aiPositionScore" DOUBLE PRECISION,
    "decidedPosition" "CoveragePosition",
    "decidedComment" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "embedding" vector(1536),
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exclusion" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionImpact" (
    "id" TEXT NOT NULL,
    "exclusionId" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExclusionImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deal_externalRef_key" ON "Deal"("externalRef");

-- CreateIndex
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");

-- CreateIndex
CREATE INDEX "Warranty_dealId_idx" ON "Warranty"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_dealId_spaReference_key" ON "Warranty"("dealId", "spaReference");

-- CreateIndex
CREATE INDEX "Exclusion_dealId_idx" ON "Exclusion"("dealId");

-- CreateIndex
CREATE INDEX "ExclusionImpact_warrantyId_idx" ON "ExclusionImpact"("warrantyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusionImpact_exclusionId_warrantyId_key" ON "ExclusionImpact"("exclusionId", "warrantyId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionImpact" ADD CONSTRAINT "ExclusionImpact_exclusionId_fkey" FOREIGN KEY ("exclusionId") REFERENCES "Exclusion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionImpact" ADD CONSTRAINT "ExclusionImpact_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

