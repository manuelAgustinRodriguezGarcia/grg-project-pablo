-- CreateEnum
CREATE TYPE "UploadedFileStatus" AS ENUM ('STORED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('STORED', 'ANALYZING', 'PENDING_DESTINATION', 'PENDING_CONFIG', 'PROCESSING', 'READY_TO_APPLY', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportActionType" AS ENUM ('IMPORTAR_LISTA', 'COMBINAR_LISTA', 'REEMPLAZAR_LISTA');

-- CreateEnum
CREATE TYPE "ImportSheetClassification" AS ENUM ('IMPORTABLE', 'INDEX', 'AUXILIARY', 'IGNORED');

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "UploadedFileStatus" NOT NULL DEFAULT 'STORED',
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "uploadedFileId" TEXT NOT NULL,
    "catalogId" TEXT,
    "folderId" TEXT,
    "targetSheetName" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'STORED',
    "actionType" "ImportActionType",
    "config" JSONB,
    "resultados" JSONB,
    "progress" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSheet" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "classification" "ImportSheetClassification" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "detectedHeaders" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPreview" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "recognizedProducts" JSONB NOT NULL,
    "matchedProducts" JSONB NOT NULL DEFAULT '[]',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_uploadedById_idx" ON "UploadedFile"("uploadedById");

-- CreateIndex
CREATE INDEX "UploadedFile_status_idx" ON "UploadedFile"("status");

-- CreateIndex
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_uploadedFileId_idx" ON "ImportJob"("uploadedFileId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_folderId_idx" ON "ImportJob"("folderId");

-- CreateIndex
CREATE INDEX "ImportJob_catalogId_idx" ON "ImportJob"("catalogId");

-- CreateIndex
CREATE INDEX "ImportSheet_importJobId_idx" ON "ImportSheet"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportSheet_importJobId_sheetName_key" ON "ImportSheet"("importJobId", "sheetName");

-- CreateIndex
CREATE UNIQUE INDEX "ImportPreview_importJobId_key" ON "ImportPreview"("importJobId");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CatalogFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSheet" ADD CONSTRAINT "ImportSheet_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportPreview" ADD CONSTRAINT "ImportPreview_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
