-- Restore trigram search indexes and add composite pagination indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_indexedText_trgm_idx"
  ON "Product" USING gin ("indexedText" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PriceItem_indexedText_trgm_idx"
  ON "PriceItem" USING gin ("indexedText" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_folderId_updatedAt_idx"
  ON "Product" ("folderId", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "PriceItem_priceListId_updatedAt_idx"
  ON "PriceItem" ("priceListId", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "FolderColumn_globalFieldKey_idx"
  ON "FolderColumn" ("globalFieldKey");
