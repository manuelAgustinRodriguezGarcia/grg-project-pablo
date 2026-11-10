-- Preserve Excel row order for future price-list imports.
-- Existing rows stay NULL (no backfill). They sort after rows that have sourceRow,
-- by createdAt ASC, id ASC. That approximates insertion order; it is not the sheet order.
-- REEMPLAZAR_LISTA with the original workbook restores the exact row numbers and
-- deletes current items, including manual rows and later edits.
ALTER TABLE "PriceItem" ADD COLUMN "sourceRow" INTEGER;

CREATE INDEX "PriceItem_priceListId_sourceRow_id_idx" ON "PriceItem"("priceListId", "sourceRow", "id");
