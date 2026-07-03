-- Add trigram indexes for global admin search across catalogs, folders, and all product row text.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_originalText_trgm_idx"
  ON "Product" USING gin ("originalText" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Catalog_name_trgm_idx"
  ON "Catalog" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Catalog_description_trgm_idx"
  ON "Catalog" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CatalogFolder_name_trgm_idx"
  ON "CatalogFolder" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "CatalogFolder_description_trgm_idx"
  ON "CatalogFolder" USING gin ("description" gin_trgm_ops);
