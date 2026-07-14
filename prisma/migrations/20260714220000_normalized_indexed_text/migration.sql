-- AlterTable
ALTER TABLE "Product" ADD COLUMN "normalizedIndexedText" TEXT;

-- AlterTable
ALTER TABLE "PriceItem" ADD COLUMN "normalizedIndexedText" TEXT;

-- Backfill: same separator family as normalizeCodeForMatch / SEARCH_SEPARATORS_PATTERN
UPDATE "Product"
SET "normalizedIndexedText" = NULLIF(
  UPPER(REGEXP_REPLACE("indexedText", '[[:space:]_./\\=*.,()-]+', '', 'g')),
  ''
)
WHERE "indexedText" IS NOT NULL
  AND BTRIM("indexedText") <> '';

UPDATE "PriceItem"
SET "normalizedIndexedText" = NULLIF(
  UPPER(REGEXP_REPLACE("indexedText", '[[:space:]_./\\=*.,()-]+', '', 'g')),
  ''
)
WHERE "indexedText" IS NOT NULL
  AND BTRIM("indexedText") <> '';
