-- CreateTable
CREATE TABLE "GlobalField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalField_key_key" ON "GlobalField"("key");

-- Enable trigram extension for text search indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Product_indexedText_trgm_idx" ON "Product" USING gin ("indexedText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_description_trgm_idx" ON "Product" USING gin ("description" gin_trgm_ops);

-- Seed global fields (RF-042 partial)
INSERT INTO "GlobalField" ("id", "key", "label", "description", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('gf_brand', 'brand', 'Marca', 'Campo global de marca', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gf_category', 'category', 'Categoría', 'Campo global de categoría', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gf_manufacturer', 'manufacturer', 'Fabricante', 'Campo global de fabricante', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gf_application', 'application', 'Aplicación', 'Campo global de aplicación', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gf_model', 'model', 'Modelo', 'Campo global de modelo', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
