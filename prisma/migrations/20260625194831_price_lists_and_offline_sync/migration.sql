-- CreateEnum
CREATE TYPE "ImportDestinationType" AS ENUM ('CATALOG_FOLDER', 'PRICE_LIST');

-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "Product_description_trgm_idx";

-- DropIndex
DROP INDEX "Product_indexedText_trgm_idx";

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN     "destinationType" "ImportDestinationType" NOT NULL DEFAULT 'CATALOG_FOLDER',
ADD COLUMN     "priceListId" TEXT;

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PriceListStatus" NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToNormalUser" BOOLEAN NOT NULL DEFAULT true,
    "sourceUploadedFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceColumn" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "internalKey" TEXT NOT NULL,
    "dataType" "ColumnDataType" NOT NULL DEFAULT 'UNKNOWN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToNormalUser" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isAdminEditable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryCode" BOOLEAN NOT NULL DEFAULT false,
    "isDescription" BOOLEAN NOT NULL DEFAULT false,
    "isPrice" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "format" TEXT,
    "unit" TEXT,
    "label" TEXT,
    "helpText" TEXT,
    "helpImagePath" TEXT,
    "helpImageThumbnailPath" TEXT,
    "helpImageMimeType" TEXT,
    "helpImageSizeBytes" INTEGER,
    "helpImageOriginalName" TEXT,
    "helpImageAltText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "primaryCode" TEXT,
    "normalizedCode" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,4),
    "dynamicData" JSONB NOT NULL DEFAULT '{}',
    "originalText" TEXT,
    "indexedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncManifest" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "catalogIds" TEXT[],
    "folderIds" TEXT[],
    "priceListIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineSyncManifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_name_key" ON "PriceList"("name");

-- CreateIndex
CREATE INDEX "PriceList_status_idx" ON "PriceList"("status");

-- CreateIndex
CREATE INDEX "PriceList_order_idx" ON "PriceList"("order");

-- CreateIndex
CREATE INDEX "PriceList_visibleToNormalUser_idx" ON "PriceList"("visibleToNormalUser");

-- CreateIndex
CREATE INDEX "PriceColumn_priceListId_idx" ON "PriceColumn"("priceListId");

-- CreateIndex
CREATE INDEX "PriceColumn_priceListId_order_idx" ON "PriceColumn"("priceListId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PriceColumn_priceListId_internalKey_key" ON "PriceColumn"("priceListId", "internalKey");

-- CreateIndex
CREATE INDEX "PriceItem_priceListId_idx" ON "PriceItem"("priceListId");

-- CreateIndex
CREATE INDEX "PriceItem_normalizedCode_idx" ON "PriceItem"("normalizedCode");

-- CreateIndex
CREATE INDEX "PriceItem_dynamicData_idx" ON "PriceItem" USING GIN ("dynamicData");

-- CreateIndex
CREATE INDEX "OfflineSyncManifest_userId_idx" ON "OfflineSyncManifest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncManifest_userId_deviceId_key" ON "OfflineSyncManifest"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "ImportJob_priceListId_idx" ON "ImportJob"("priceListId");

-- CreateIndex
CREATE INDEX "ImportJob_destinationType_idx" ON "ImportJob"("destinationType");

-- AddForeignKey
ALTER TABLE "PriceColumn" ADD CONSTRAINT "PriceColumn_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceItem" ADD CONSTRAINT "PriceItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncManifest" ADD CONSTRAINT "OfflineSyncManifest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
