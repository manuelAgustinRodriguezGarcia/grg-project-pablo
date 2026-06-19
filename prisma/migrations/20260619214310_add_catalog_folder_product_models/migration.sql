-- CreateEnum
CREATE TYPE "FolderStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ColumnDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'IMAGE', 'FORMULA', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Catalog" ADD COLUMN     "visibleToNormalUser" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CatalogFolder" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FolderStatus" NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToNormalUser" BOOLEAN NOT NULL DEFAULT true,
    "searchConfig" JSONB,
    "filterConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderColumn" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "internalKey" TEXT NOT NULL,
    "dataType" "ColumnDataType" NOT NULL DEFAULT 'UNKNOWN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToNormalUser" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isGloballySearchable" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isGloballyFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isAdminEditable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryCode" BOOLEAN NOT NULL DEFAULT false,
    "isEquivalence" BOOLEAN NOT NULL DEFAULT false,
    "isDescription" BOOLEAN NOT NULL DEFAULT false,
    "isImageCode" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "format" TEXT,
    "unit" TEXT,
    "label" TEXT,
    "globalFieldKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "primaryCode" TEXT,
    "normalizedCode" TEXT,
    "description" TEXT,
    "dynamicData" JSONB NOT NULL DEFAULT '{}',
    "originalText" TEXT,
    "indexedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogFolder_catalogId_idx" ON "CatalogFolder"("catalogId");

-- CreateIndex
CREATE INDEX "CatalogFolder_catalogId_order_idx" ON "CatalogFolder"("catalogId", "order");

-- CreateIndex
CREATE INDEX "CatalogFolder_status_idx" ON "CatalogFolder"("status");

-- CreateIndex
CREATE INDEX "CatalogFolder_visibleToNormalUser_idx" ON "CatalogFolder"("visibleToNormalUser");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogFolder_catalogId_name_key" ON "CatalogFolder"("catalogId", "name");

-- CreateIndex
CREATE INDEX "FolderColumn_folderId_idx" ON "FolderColumn"("folderId");

-- CreateIndex
CREATE INDEX "FolderColumn_folderId_order_idx" ON "FolderColumn"("folderId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FolderColumn_folderId_internalKey_key" ON "FolderColumn"("folderId", "internalKey");

-- CreateIndex
CREATE INDEX "Product_folderId_idx" ON "Product"("folderId");

-- CreateIndex
CREATE INDEX "Product_normalizedCode_idx" ON "Product"("normalizedCode");

-- CreateIndex
CREATE INDEX "Product_dynamicData_idx" ON "Product" USING GIN ("dynamicData");

-- CreateIndex
CREATE INDEX "Catalog_status_visibleToNormalUser_idx" ON "Catalog"("status", "visibleToNormalUser");

-- AddForeignKey
ALTER TABLE "CatalogFolder" ADD CONSTRAINT "CatalogFolder_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderColumn" ADD CONSTRAINT "FolderColumn_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CatalogFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CatalogFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
