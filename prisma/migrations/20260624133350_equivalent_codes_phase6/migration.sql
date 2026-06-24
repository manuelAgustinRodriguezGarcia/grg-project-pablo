-- CreateTable
CREATE TABLE "EquivalentCode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalCode" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "sourceColumnKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquivalentCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquivalentCode_productId_idx" ON "EquivalentCode"("productId");

-- CreateIndex
CREATE INDEX "EquivalentCode_normalizedCode_idx" ON "EquivalentCode"("normalizedCode");

-- CreateIndex
CREATE UNIQUE INDEX "EquivalentCode_productId_normalizedCode_key" ON "EquivalentCode"("productId", "normalizedCode");

-- AddForeignKey
ALTER TABLE "EquivalentCode" ADD CONSTRAINT "EquivalentCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
