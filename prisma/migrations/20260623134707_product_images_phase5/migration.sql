-- CreateEnum
CREATE TYPE "ProductImageStatus" AS ENUM ('ASSOCIATED_AUTO', 'ASSOCIATED_MANUAL', 'PENDING_REVIEW', 'FILE_NOT_FOUND', 'AMBIGUOUS', 'DUPLICATE_NAME', 'FORMAT_REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProductImageSource" AS ENUM ('EMBEDDED', 'EXTERNAL_ZIP', 'EXTERNAL_UPLOAD', 'MANUAL');

-- AlterEnum
ALTER TYPE "ImportJobStatus" ADD VALUE 'PENDING_REVIEW';

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "importJobId" TEXT,
    "storagePath" TEXT,
    "thumbnailPath" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceColumn" TEXT,
    "status" "ProductImageStatus" NOT NULL,
    "source" "ProductImageSource" NOT NULL,
    "matchCandidates" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_importJobId_status_idx" ON "ProductImage"("importJobId", "status");

-- CreateIndex
CREATE INDEX "ProductImage_status_idx" ON "ProductImage"("status");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
