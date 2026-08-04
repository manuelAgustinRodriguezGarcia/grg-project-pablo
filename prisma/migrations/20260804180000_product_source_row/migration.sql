-- Preserve Excel row order for future imports without backfilling existing products.
ALTER TABLE "Product" ADD COLUMN "sourceRow" INTEGER;

CREATE INDEX "Product_folderId_sourceRow_id_idx" ON "Product"("folderId", "sourceRow", "id");
