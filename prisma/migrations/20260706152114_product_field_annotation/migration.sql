-- CreateTable
CREATE TABLE "ProductFieldAnnotation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "columnInternalKey" TEXT NOT NULL,
    "helpText" TEXT,
    "helpImagePath" TEXT,
    "helpImageThumbnailPath" TEXT,
    "helpImageMimeType" TEXT,
    "helpImageSizeBytes" INTEGER,
    "helpImageOriginalName" TEXT,
    "helpImageAltText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFieldAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFieldAnnotation_productId_idx" ON "ProductFieldAnnotation"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFieldAnnotation_productId_columnInternalKey_key" ON "ProductFieldAnnotation"("productId", "columnInternalKey");

-- AddForeignKey
ALTER TABLE "ProductFieldAnnotation" ADD CONSTRAINT "ProductFieldAnnotation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
